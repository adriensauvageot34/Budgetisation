import type { MonthKey, Operation, ResourceType } from "@/domain/budget";

type SalaryProfile = {
  id: "adrien" | "manon";
  employer: string;
  usualMinimum: number;
  usualMaximum: number;
  januaryDoubleMinimum?: number;
  januaryDoubleMaximum?: number;
};

export const salaryProfiles: SalaryProfile[] = [
  {
    id: "adrien",
    employer: "Digital Learning Contest",
    usualMinimum: 1900,
    usualMaximum: 2400,
  },
  {
    id: "manon",
    employer: "Promotrans",
    usualMinimum: 1400,
    usualMaximum: 1800,
    januaryDoubleMinimum: 2800,
    januaryDoubleMaximum: 3600,
  },
];

const salaryKeyword = /\b(SALAIRE|PAIE|PAYE|REMUNERATION)\b/i;
const explicitSalaryMonth =
  /\b(?:SALAIRE|PAIE|PAYE|REMUNERATION)\s*(0?[1-9]|1[0-2])(?:\s+|[/-])(\d{4})\b/i;
const compactSalaryMonth =
  /\b(?:SALAIRE|PAIE|PAYE|REMUNERATION)\s*(0[1-9]|1[0-2])(\d{2})\b/i;

function normalized(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("fr-FR");
}

function adjacentMonth(month: MonthKey, delta: -1 | 1): MonthKey {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function effectiveResourceType(operation: Operation): ResourceType | null {
  if (operation.resourceType) return operation.resourceType;
  if (operation.flow === "Revenu") return "Revenu";
  if (operation.flow === "Remboursement") return "Remboursement";
  if (operation.flow === "Transfert interne") {
    if (operation.amount <= 0) return "Transfert interne";
    const counterparty = normalized(
      `${operation.normalizedMerchant} ${operation.sourceLabel}`,
    );
    const householdTransfer = [
      "ADRIEN SAUVAGEOT",
      "SAUVAGEOT ADRIEN",
      "MANON FERRET",
      "FERRET MANON",
    ].some((name) => counterparty.includes(name));
    return householdTransfer ? "Transfert interne" : "À qualifier";
  }
  if (operation.flow === "Flux technique") return "Flux technique";
  return operation.amount > 0 ? "À qualifier" : null;
}

function salaryProfile(operation: Operation) {
  if (effectiveResourceType(operation) !== "Revenu" || operation.amount <= 0) {
    return null;
  }
  const identity = normalized(
    `${operation.normalizedMerchant} ${operation.sourceLabel}`,
  );
  const profile = salaryProfiles.find((entry) =>
    identity.includes(normalized(entry.employer)),
  );
  if (!profile) return null;

  const amount = operation.amount;
  const inUsualRange =
    amount >= profile.usualMinimum && amount <= profile.usualMaximum;
  const inJanuaryDoubleRange =
    operation.importMonth.endsWith("-01") &&
    profile.januaryDoubleMinimum !== undefined &&
    profile.januaryDoubleMaximum !== undefined &&
    amount >= profile.januaryDoubleMinimum &&
    amount <= profile.januaryDoubleMaximum;

  return salaryKeyword.test(normalized(operation.sourceLabel)) ||
    inUsualRange ||
    inJanuaryDoubleRange
    ? profile
    : null;
}

function salaryMonthFromLabel(operation: Operation): MonthKey | null {
  const label = normalized(operation.sourceLabel);
  const explicitMatch = label.match(explicitSalaryMonth);
  if (explicitMatch) {
    return `${explicitMatch[2]}-${explicitMatch[1].padStart(2, "0")}`;
  }
  const compactMatch = label.match(compactSalaryMonth);
  return compactMatch ? `20${compactMatch[2]}-${compactMatch[1]}` : null;
}

function automaticMonth(operation: Operation): MonthKey {
  const resourceType = effectiveResourceType(operation);
  if (operation.amount <= 0) return operation.importMonth;
  if (resourceType === "Entrée d'argent") {
    return Number(operation.date.slice(8, 10)) >= 26
      ? adjacentMonth(operation.importMonth, 1)
      : operation.importMonth;
  }
  if (resourceType === "Revenu" && salaryProfile(operation)) {
    return salaryMonthFromLabel(operation) ?? operation.importMonth;
  }
  return operation.importMonth;
}

export function applyInflowAnalysis(operations: Operation[]): Operation[] {
  const analysed = operations.map((operation) => {
    const resourceType = effectiveResourceType(operation);
    const override = operation.amount > 0 ? operation.analysisMonthOverride : null;
    return {
      ...operation,
      resourceType,
      analysisMonth: override ?? automaticMonth(operation),
      analysisUncertain: resourceType === "À qualifier",
    };
  });

  for (const profile of salaryProfiles) {
    const candidates = analysed.filter(
      (operation) =>
        salaryProfile(operation)?.id === profile.id &&
        !operation.analysisMonthOverride &&
        !salaryMonthFromLabel(operation),
    );
    const bankMonths = new Map<MonthKey, Operation[]>();
    for (const operation of candidates) {
      const group = bankMonths.get(operation.importMonth) ?? [];
      group.push(operation);
      bankMonths.set(operation.importMonth, group);
    }

    for (const [bankMonth, group] of bankMonths) {
      if (group.length < 2) continue;
      const januaryDouble = profile.id === "manon" && bankMonth.endsWith("-01");
      const previousMonth = adjacentMonth(bankMonth, -1);
      const previousAlreadyAssigned = analysed.some(
        (operation) =>
          operation.id !== group[0]?.id &&
          salaryProfile(operation)?.id === profile.id &&
          operation.analysisMonth === previousMonth,
      );

      if (group.length === 2 && !januaryDouble && !previousAlreadyAssigned) {
        const first = [...group].sort(
          (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
        )[0];
        if (first) first.analysisMonth = previousMonth;
      } else if (!januaryDouble) {
        group.forEach((operation) => {
          operation.analysisUncertain = true;
        });
      }
    }
  }

  return analysed;
}

export function operationAnalysisMonth(operation: Operation): MonthKey {
  return operation.analysisMonth ?? operation.importMonth;
}
