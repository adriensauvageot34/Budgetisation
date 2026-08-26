import "server-only";

import type { EconomicComponentFact } from "@/analytics/facts";
import type {
  CategoryId,
  MerchantId,
  OperationId,
  SubcategoryId,
} from "@/core/identity";
import {
  addMoney,
  parseMoney,
  type Money,
} from "@/core/money";
import type { Coverage } from "@/core/metrics";
import type { AnalysisScope } from "@/core/scope";
import {
  addMonths,
  parseLocalDate,
  resolveGlobalWindowMonths,
  type LocalDate,
  type YearMonth,
} from "@/core/time";
import type {
  CountMetricEnvelope,
  MoneyMetricEnvelope,
  ScopedMetricReadModel,
} from "@/query-api";
import type { BootstrapAnalysisStatus } from "@/server/bootstrap/types";
import type {
  AuthorizedRuntimeContext,
} from "@/server/canonical/context";
import {
  canonicalMoney,
  canonicalString,
  optionalCanonicalString,
  type CanonicalRecord,
} from "@/server/canonical/record";
import type { CanonicalDateRange } from "@/server/canonical/repository";

export type CanonicalOperation = {
  readonly operationId: OperationId;
  readonly bankDate: LocalDate;
  readonly label: string;
  readonly bankAmount: Money;
  readonly merchantId?: MerchantId;
  readonly categoryId?: CategoryId;
  readonly subcategoryId?: SubcategoryId;
  readonly preciseType?: string;
  readonly necessity?: string;
  readonly fixedVariable?: string;
  readonly lifeScope?: string;
  readonly raw: CanonicalRecord;
};

export function operationFromCanonicalRow(
  row: CanonicalRecord,
): CanonicalOperation {
  const optionalId = (keys: readonly string[]) => optionalCanonicalString(row, keys);
  return {
    operationId: canonicalString(row, ["operation_id"], "operations") as OperationId,
    bankDate: parseLocalDate(
      canonicalString(row, ["date_bancaire", "bank_date", "date"], "operations"),
    ),
    label: canonicalString(
      row,
      ["libelle_bancaire", "bank_label", "source_label", "label", "libelle"],
      "operations",
    ).trim(),
    bankAmount: canonicalMoney(
      row,
      [
        "montant_bancaire_exact",
        "bank_amount",
        "amount",
        "montant",
      ],
      "operations",
    ),
    ...(optionalId(["merchant_id"]) === undefined
      ? {}
      : { merchantId: optionalId(["merchant_id"]) as MerchantId }),
    ...(optionalId(["category_id"]) === undefined
      ? {}
      : { categoryId: optionalId(["category_id"]) as CategoryId }),
    ...(optionalId(["subcategory_id"]) === undefined
      ? {}
      : { subcategoryId: optionalId(["subcategory_id"]) as SubcategoryId }),
    ...(optionalId(["type_precis", "precise_type", "precise_type_label"]) === undefined
      ? {}
      : { preciseType: optionalId(["type_precis", "precise_type", "precise_type_label"]) }),
    ...(optionalId(["importance"]) === undefined
      ? {}
      : { necessity: optionalId(["importance"]) }),
    ...(optionalId(["nature_fixe_variable"]) === undefined
      ? {}
      : { fixedVariable: optionalId(["nature_fixe_variable"]) }),
    ...(optionalId(["contexte_vie"]) === undefined
      ? {}
      : { lifeScope: optionalId(["contexte_vie"]) }),
    raw: row,
  };
}

export function monthRange(month: YearMonth): CanonicalDateRange {
  return {
    start: parseLocalDate(`${month}-01`),
    endExclusive: parseLocalDate(`${addMonths(month, 1)}-01`),
  };
}

export function scopeRange(scope: AnalysisScope): CanonicalDateRange {
  if (scope.time.kind === "month") return monthRange(scope.time.month);
  const months = resolveGlobalWindowMonths(
    scope.time.observationWindow,
    scope.time.asOf,
  );
  if (months.length === 0) throw new TypeError("GlobalWindow sans mois.");
  return {
    start: parseLocalDate(`${months[0]}-01`),
    endExclusive: parseLocalDate(`${addMonths(months[months.length - 1], 1)}-01`),
  };
}

export function periodCompleteness(
  context: AuthorizedRuntimeContext,
  month: YearMonth,
): BootstrapAnalysisStatus {
  return context.periods.find((period) => period.month.startsWith(month))
    ?.financeStatus ?? "unknown";
}

export function moneyEnvelope(
  value: Money,
  coverage?: Coverage,
): MoneyMetricEnvelope {
  return {
    availability: "known",
    value,
    unit: "EUR",
    provenance: "observed",
    ...(coverage === undefined ? {} : { coverage }),
  };
}

export function unavailableMoneyEnvelope(
  availability: "unknown" | "conflict" | "not_applicable",
): MoneyMetricEnvelope {
  return {
    availability,
    value: null,
    unit: "EUR",
    provenance: "observed",
  };
}

export function countEnvelope(
  value: number,
  coverage?: Coverage,
): CountMetricEnvelope {
  return {
    availability: "known",
    value,
    unit: "count",
    provenance: "observed",
    ...(coverage === undefined ? {} : { coverage }),
  };
}

export function moneyEnvelopeFromScoped(
  metric: ScopedMetricReadModel,
): MoneyMetricEnvelope {
  if (!metric.envelope.unit.startsWith("EUR")) {
    throw new TypeError("Une métrique monétaire était attendue.");
  }
  return metric.envelope as MoneyMetricEnvelope;
}

export function sumMoney(values: readonly Money[]): Money {
  return values.reduce(addMoney, parseMoney("0"));
}

export function exactEconomicAmountForDate(
  facts: readonly EconomicComponentFact[],
  date: LocalDate,
  periodStatus: BootstrapAnalysisStatus,
): {
  readonly envelope: MoneyMetricEnvelope;
  readonly contributions: readonly {
    readonly fact: EconomicComponentFact;
    readonly amount: Money;
  }[];
} {
  let ambiguous = false;
  let conflict = false;
  const contributions: {
    fact: EconomicComponentFact;
    amount: Money;
  }[] = [];
  for (const fact of facts) {
    if (fact.economicTiming.kind === "conflict") {
      conflict = true;
      continue;
    }
    if (fact.economicTiming.kind === "unknown") {
      if (fact.bankDate.kind === "known" && fact.bankDate.date === date) ambiguous = true;
      continue;
    }
    for (const segment of fact.economicTiming.segments) {
      if (segment.periodStart === date && segment.periodEnd === date) {
        contributions.push({ fact, amount: segment.amount });
      } else if (
        segment.periodStart !== null &&
        segment.periodEnd !== null &&
        segment.periodStart <= date &&
        date <= segment.periodEnd
      ) {
        ambiguous = true;
      }
      if (segment.timingState !== "known") ambiguous = true;
    }
    if (fact.economicTiming.kind === "partial") ambiguous = true;
  }
  if (conflict) {
    return { envelope: unavailableMoneyEnvelope("conflict"), contributions: [] };
  }
  const amount = sumMoney(contributions.map(({ amount: value }) => value));
  if (contributions.length === 0 && (ambiguous || periodStatus !== "complete")) {
    return { envelope: unavailableMoneyEnvelope("unknown"), contributions: [] };
  }
  return {
    envelope: moneyEnvelope(
      amount,
      ambiguous || periodStatus !== "complete"
        ? { level: "partial" }
        : { level: "complete" },
    ),
    contributions,
  };
}

export function selectFactsForSubject<
  Fact extends { readonly personId?: string; readonly participantIds?: readonly string[] },
>(facts: readonly Fact[], scope: AnalysisScope): readonly Fact[] {
  if (scope.subject.kind === "household") return facts;
  const personId = scope.subject.personId;
  return facts.filter(
    (fact) =>
      fact.personId === personId ||
      fact.participantIds?.includes(personId) === true,
  );
}
