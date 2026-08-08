import * as XLSX from "xlsx";
import type {
  AnalyticalStatus,
  FlowType,
  Importance,
  Recurrence,
} from "@/domain/budget";

const targetImportance = new Set<Importance>([
  "Indispensable",
  "Contrainte",
  "Ajustable",
  "Optionnelle",
]);

export type ImportOperationRow = {
  date: string;
  import_month: string;
  amount: number;
  debit: number | null;
  credit: number | null;
  source_label: string;
  normalized_merchant: string | null;
  flow: FlowType;
  category: string | null;
  subcategory: string | null;
  precise_type: string | null;
  recurrence: Recurrence | null;
  importance: Importance | null;
  analytical_status: AnalyticalStatus;
  note: string | null;
  event: string | null;
  uncertain: boolean;
  fingerprint: string;
  source_metadata: Record<string, unknown>;
};

export type PreviewRow = ImportOperationRow & {
  sourceIndex: number;
  missing: string[];
  potentialDuplicate: boolean;
};

export type ParsedImport = {
  rows: PreviewRow[];
  sourceRows: number;
  potentialDuplicatesWithinFile: number;
  missingRows: number;
  uncertainRows: number;
};

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result || null;
}

function asMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Math.round(value * 100) / 100;
  const normalized = String(value)
    .replace(/\u202f/g, "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[€]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }
  if (typeof value === "number") {
    const parts = XLSX.SSF.parse_date_code(value);
    if (!parts) return null;
    return `${parts.y}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
  }
  const input = asText(value);
  if (!input) return null;
  const french = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (french) {
    return `${french[3]}-${french[2].padStart(2, "0")}-${french[1].padStart(2, "0")}`;
  }
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function importMonth(value: unknown, date: string | null): string | null {
  const parsedDate = isoDate(value);
  if (parsedDate) return `${parsedDate.slice(0, 7)}-01`;
  const input = asText(value);
  const match = input?.match(/^(\d{4})-(\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-01`;
  return date ? `${date.slice(0, 7)}-01` : null;
}

function targetFlow(
  rawFlow: string | null,
  family: string | null,
  nature: string | null,
): FlowType {
  if (family === "Transferts" || nature === "Transfert") {
    return "Transfert interne";
  }
  if (family === "Remboursements" || nature === "Remboursement") {
    return "Remboursement";
  }
  if (family === "Revenus" || nature === "Revenu") return "Revenu";
  if (nature === "À ventiler" || family === "Espèces") return "Flux technique";
  if (rawFlow === "Revenu") return "Revenu";
  return "Dépense";
}

function targetStatus(
  nature: string | null,
  priority: string | null,
  precision: string | null,
): AnalyticalStatus {
  if (nature === "Exceptionnelle") return "Exceptionnel";
  if (priority === "Hors budget") return "Hors budget";
  if (nature === "À ventiler" || precision === "À ventiler") return "À ventiler";
  return "Habituel";
}

function serializableRaw(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? isoDate(value) : value,
    ]),
  );
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function fingerprint(row: Omit<ImportOperationRow, "fingerprint">) {
  return sha256(
    [
      row.date,
      row.source_label,
      row.debit === null ? "" : row.debit.toFixed(2),
      row.credit === null ? "" : row.credit.toFixed(2),
      row.amount.toFixed(2),
      row.normalized_merchant ?? "",
      row.category ?? "",
      row.subcategory ?? "",
      row.import_month,
    ].join("|"),
  );
}

export async function parseImportFile(file: File): Promise<ParsedImport> {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
    raw: true,
  });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) throw new Error("Le fichier ne contient aucune feuille.");
  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });
  const headers = XLSX.utils
    .sheet_to_json<unknown[]>(sheet, { header: 1, range: 0, blankrows: false })
    .at(0)
    ?.map((value) => String(value).trim()) ?? [];

  const requiredHeaders = ["Date", "Libellé bancaire", "Montant net"];
  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header),
  );
  if (missingHeaders.length) {
    throw new Error(`Colonnes obligatoires absentes : ${missingHeaders.join(", ")}.`);
  }

  const transformed = await Promise.all(
    rows.map(async (source, index): Promise<PreviewRow> => {
      const date = isoDate(source["Date"]);
      const month = importMonth(source["Mois"], date);
      const amount = asMoney(source["Montant net"]);
      const sourceLabel = asText(source["Libellé bancaire"]);
      const family = asText(source["Famille"]);
      const subcategory = asText(source["Catégorie détaillée"]);
      const nature = asText(source["Nature"]);
      const priority = asText(source["Priorité budgétaire"]);
      const precision = asText(source["Précision"]);
      const missing = [
        !date ? "Date" : null,
        !month ? "Mois" : null,
        amount === null ? "Montant net" : null,
        !sourceLabel ? "Libellé bancaire" : null,
        !family ? "Famille" : null,
        !subcategory ? "Catégorie détaillée" : null,
      ].filter((value): value is string => Boolean(value));

      const base: Omit<ImportOperationRow, "fingerprint"> = {
        date: date ?? "",
        import_month: month ?? "",
        amount: amount ?? 0,
        debit: asMoney(source["Débit"]),
        credit: asMoney(source["Crédit"]),
        source_label: sourceLabel ?? "",
        normalized_merchant: asText(source["Commerçant / tiers"]),
        flow: targetFlow(asText(source["Flux"]), family, nature),
        category: family,
        subcategory,
        precise_type: asText(source["Type précis"]),
        recurrence:
          nature === "Fixe" || nature === "Variable" ? nature : null,
        importance:
          priority && targetImportance.has(priority as Importance)
            ? (priority as Importance)
            : null,
        analytical_status: targetStatus(nature, priority, precision),
        note: asText(source["Note"]),
        event: asText(source["Événement"]),
        uncertain:
          precision === "À ventiler" ||
          precision === "À préciser" ||
          priority === "À identifier" ||
          !family ||
          !subcategory,
        source_metadata: serializableRaw(source),
      };

      return {
        ...base,
        fingerprint: await fingerprint(base),
        sourceIndex: index + 2,
        missing,
        potentialDuplicate: false,
      };
    }),
  );

  const fingerprintCounts = new Map<string, number>();
  transformed.forEach((row) =>
    fingerprintCounts.set(
      row.fingerprint,
      (fingerprintCounts.get(row.fingerprint) ?? 0) + 1,
    ),
  );
  transformed.forEach((row) => {
    row.potentialDuplicate = (fingerprintCounts.get(row.fingerprint) ?? 0) > 1;
  });

  return {
    rows: transformed,
    sourceRows: rows.length,
    potentialDuplicatesWithinFile: transformed.filter(
      (row) => row.potentialDuplicate,
    ).length,
    missingRows: transformed.filter((row) => row.missing.length > 0).length,
    uncertainRows: transformed.filter((row) => row.uncertain).length,
  };
}
