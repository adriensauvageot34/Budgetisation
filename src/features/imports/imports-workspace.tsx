"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Info,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import type { ImportBatch } from "@/domain/budget";
import {
  parseImportFile,
  type ParsedImport,
  type PreviewRow,
} from "@/features/imports/import-file";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatMonth } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

function batchPeriod(batch: ImportBatch) {
  if (batch.firstMonth && batch.lastMonth && batch.firstMonth !== batch.lastMonth) {
    return `${formatMonth(batch.firstMonth)} — ${formatMonth(batch.lastMonth)}`;
  }
  return batch.month ? formatMonth(batch.month) : "Non renseigné";
}

async function existingFingerprints(rows: PreviewRow[]) {
  const supabase = createClient();
  const found = new Set<string>();
  for (let offset = 0; offset < rows.length; offset += 100) {
    const chunk = rows.slice(offset, offset + 100).map((row) => row.fingerprint);
    const { data, error } = await supabase
      .from("operations")
      .select("fingerprint")
      .in("fingerprint", chunk);
    if (error) throw new Error(error.message);
    data?.forEach((row) => found.add(row.fingerprint));
  }
  return found;
}

export function ImportsWorkspace({
  batches,
  embedded = false,
  onNavigate,
}: {
  batches: ImportBatch[];
  embedded?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadFile(selected: File | null) {
    if (!selected) return;
    setFile(selected);
    setParsed(null);
    setMessage(null);
    setError(null);
    setBusy(true);
    try {
      const result = await parseImportFile(selected);
      const fingerprints = await existingFingerprints(result.rows);
      result.rows.forEach((row) => {
        row.potentialDuplicate =
          row.potentialDuplicate || fingerprints.has(row.fingerprint);
      });
      setParsed(result);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Lecture du fichier impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!file || !parsed) return;
    const rows = parsed.rows.filter(
      (row) =>
        !row.missing.some((field) =>
          ["Date", "Mois", "Montant net", "Libellé bancaire"].includes(field),
        ),
    );
    if (!rows.length) {
      setError("Aucune ligne insérable après les contrôles.");
      return;
    }

    setBusy(true);
    setError(null);
    const payload = rows.map(
      ({ sourceIndex: _sourceIndex, missing: _missing, potentialDuplicate: _duplicate, ...row }) =>
        row,
    );
    const { data, error: rpcError } = await createClient().rpc(
      "import_operations",
      {
        source_filename: file.name,
        source_rows: payload,
      },
    );
    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }

    const inserted =
      data && typeof data === "object" && "inserted" in data
        ? Number(data.inserted)
        : rows.length;
    setMessage(`${inserted} opérations ont été importées.`);
    setParsed(null);
    setFile(null);
    setBusy(false);
    router.refresh();
  }

  const potentialDuplicates =
    parsed?.rows.filter((row) => row.potentialDuplicate).length ?? 0;
  const blockingRows =
    parsed?.rows.filter((row) =>
      row.missing.some((field) =>
        ["Date", "Mois", "Montant net", "Libellé bancaire"].includes(field),
      ),
    ).length ?? 0;
  const insertable =
    (parsed?.rows.length ?? 0) - blockingRows;

  return (
    <div>
      {embedded ? (
        <div className="mb-5">
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            Lisez un relevé CSV ou XLSX, contrôlez les données puis confirmez
            son insertion dans Supabase.
          </p>
        </div>
      ) : (
        <PageHeader
          eyebrow="Données"
          title="Imports"
          description="Lisez un relevé CSV ou XLSX, contrôlez les données et confirmez son insertion dans Supabase."
          action={
            <button
              type="button"
              className="button-primary"
              onClick={() => inputRef.current?.click()}
            >
              <FileUp size={17} />
              Nouvel import
            </button>
          }
        />
      )}

      <div className="mb-5 flex gap-3 rounded-[var(--radius-md)] border border-[#cfded8] bg-[#e9f1ee] p-4">
        <Info size={19} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
        <p className="text-sm leading-6 text-[var(--color-muted)]">
          Le fichier reste local pendant la prévisualisation. Seules les lignes
          confirmées sont envoyées à Supabase, avec leur libellé bancaire original
          et leurs métadonnées source.
        </p>
      </div>

      {error ? (
        <p className="mb-5 rounded-[var(--radius-md)] bg-[#f7dfda] p-4 text-sm font-bold text-[#9a463c]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-5 rounded-[var(--radius-md)] bg-[#e9f1ee] p-4 text-sm font-bold text-[var(--color-primary-deep)]">
          {message}
        </p>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="card p-4 sm:p-6">
          <p className="eyebrow mb-2">Nouveau fichier</p>
          <h2 className="text-xl font-black">Déposer un relevé</h2>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => loadFile(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              loadFile(event.dataTransfer.files?.[0] ?? null);
            }}
            className="mt-5 flex min-h-[250px] w-full flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed border-[#bfcac5] bg-[#fafaf7] px-6 text-center transition hover:border-[var(--color-primary)]"
          >
            <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <UploadCloud size={26} />
            </span>
            <span className="font-black">Glissez un fichier Excel ou CSV</span>
            <span className="mt-2 text-sm text-[var(--color-muted)]">
              ou cliquez pour sélectionner
            </span>
            {file ? <span className="badge mt-4">{file.name}</span> : null}
          </button>
        </div>

        <div className="card min-w-0 p-4 sm:p-6">
          <p className="eyebrow mb-2">Prévisualisation et contrôles</p>
          {!parsed ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-[var(--color-muted)]">
              <FileSpreadsheet size={34} className="text-[var(--color-primary)]" />
              <p className="mt-3 font-black text-[var(--color-ink)]">
                {busy ? "Lecture et contrôle en cours…" : "Aucun fichier sélectionné"}
              </p>
              <p className="mt-1 text-sm">
                Les données seront affichées ici avant toute insertion.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="soft-card p-3">
                  <p className="text-xs font-bold text-[var(--color-muted)]">Prêtes</p>
                  <p className="mt-1 text-xl font-black">{insertable}</p>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[#f6ead2] p-3">
                  <p className="text-xs font-bold text-[#8a6021]">Incertaines</p>
                  <p className="mt-1 text-xl font-black">{parsed.uncertainRows}</p>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[#f7dfda] p-3">
                  <p className="text-xs font-bold text-[#9a463c]">Doublons</p>
                  <p className="mt-1 text-xl font-black">
                    {potentialDuplicates}
                  </p>
                </div>
                <div className="soft-card p-3">
                  <p className="text-xs font-bold text-[var(--color-muted)]">Manquantes</p>
                  <p className="mt-1 text-xl font-black">{parsed.missingRows}</p>
                </div>
              </div>

              {potentialDuplicates > 0 ? (
                <p className="mb-4 text-sm text-[var(--color-muted)]">
                  Les doublons potentiels sont signalés, mais ne sont pas
                  exclus : ils seront insérés si vous confirmez l’import.
                </p>
              ) : null}

              <div className="table-shell">
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[760px]">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Libellé original</th>
                        <th>Montant</th>
                        <th>Classement</th>
                        <th>Contrôle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 10).map((row) => (
                        <tr key={`${row.sourceIndex}-${row.fingerprint}`}>
                          <td>{row.date ? formatDate(row.date) : "Non renseigné"}</td>
                          <td className="font-extrabold">
                            {row.source_label || "Non renseigné"}
                          </td>
                          <td className={row.amount >= 0 ? "positive" : "negative"}>
                            {formatCurrency(row.amount, true)}
                          </td>
                          <td>
                            {row.category ?? "Non renseigné"} ·{" "}
                            {row.subcategory ?? "Non renseigné"}
                          </td>
                          <td>
                            {row.potentialDuplicate ? (
                              <span className="badge" data-tone="negative">
                                <AlertTriangle size={12} /> Doublon potentiel
                              </span>
                            ) : row.missing.length ? (
                              <span className="badge" data-tone="warning">
                                <TriangleAlert size={12} /> {row.missing.join(", ")}
                              </span>
                            ) : row.uncertain ? (
                              <span className="badge" data-tone="warning">
                                <TriangleAlert size={12} /> Incertain
                              </span>
                            ) : (
                              <span className="badge" data-tone="positive">
                                <CheckCircle2 size={12} /> Prêt
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {parsed.rows.length > 10 ? (
                <p className="mt-3 text-xs text-[var(--color-muted)]">
                  10 lignes affichées sur {parsed.rows.length}.
                </p>
              ) : null}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="button-primary"
                  disabled={busy || insertable === 0}
                  onClick={confirmImport}
                >
                  <FileUp size={17} />
                  {busy ? "Insertion…" : `Confirmer ${insertable} lignes`}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {embedded ? (
        <div className="mt-5 flex justify-end">
          <Link
            href="/imports"
            className="button-secondary"
            onClick={onNavigate}
          >
            Voir les imports précédents
          </Link>
        </div>
      ) : (
      <section className="card mt-5 overflow-hidden">
        <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-6">
          <p className="eyebrow mb-2">Traçabilité</p>
          <h2 className="text-xl font-black">Imports précédents</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[800px]">
            <thead>
              <tr>
                <th>Période</th>
                <th>Fichier</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Lignes</th>
                <th>Avertissements</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id}>
                  <td className="font-extrabold capitalize">{batchPeriod(batch)}</td>
                  <td>{batch.filename}</td>
                  <td>
                    {new Intl.DateTimeFormat("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(batch.importedAt))}
                  </td>
                  <td>
                    <span
                      className="badge"
                      data-tone={batch.warnings ? "warning" : "positive"}
                    >
                      {batch.warnings ? (
                        <TriangleAlert size={12} />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      {batch.status}
                    </span>
                  </td>
                  <td>{batch.rows}</td>
                  <td>{batch.warnings || "Aucun"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}
    </div>
  );
}
