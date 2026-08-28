import "server-only";

import {
  calculateMinimalMonthCost,
  MINIMAL_MONTH_METHOD_VERSION,
  type MinimalMonthComponent,
} from "@/analytics/baseline";
import type { MetricProductionSource } from "@/analytics/production";
import { parseMoney } from "@/core/money";
import {
  parseCoverage,
  parseProvenance,
  parseSupport,
} from "@/core/metrics";
import type { ScopeHash } from "@/core/scope";
import { parseYearMonth, type YearMonth } from "@/core/time";
import frozenData from "./certified-historical-minimal.json";

type MinimalMonthSource = Extract<
  MetricProductionSource,
  { readonly kind: "minimal_month" }
>;
type WithoutScope<T extends { readonly scopeHash: unknown }> = T extends unknown
  ? Omit<T, "scopeHash">
  : never;
type FrozenMinimalMonthSource = WithoutScope<MinimalMonthSource>;

type FrozenRow = {
  readonly month?: unknown;
  readonly finalValue?: unknown;
  readonly availability?: unknown;
  readonly neutralVariableComponents?: unknown;
  readonly mandatoryMonthlyObligationsAndProvisions?: unknown;
  readonly MethodVersion?: unknown;
  readonly coverage?: unknown;
};

export type CertifiedHistoricalMinimalSource = {
  readonly resolve: (input: {
    readonly month: YearMonth;
    readonly scopeHash: ScopeHash;
  }) => MinimalMonthSource | null;
};

function parseComponents(value: unknown): readonly MinimalMonthComponent[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new TypeError("Les composantes Minimal historiques certifiées sont invalides.");
  }
  return value.map((candidate) => {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new TypeError("Une composante Minimal historique certifiée est invalide.");
    }
    const component = candidate as Record<string, unknown>;
    if (
      typeof component.canonicalComponentKey !== "string" ||
      component.canonicalComponentKey.length === 0
    ) {
      throw new TypeError("Une clé de composante Minimal historique est invalide.");
    }
    return {
      canonicalComponentKey: component.canonicalComponentKey,
      amount: parseMoney(String(component.amount)),
      support: parseSupport(component.support),
      coverage: parseCoverage(component.coverage),
      provenance: parseProvenance(component.provenance),
    };
  });
}

function parseFrozenRows(value: unknown): ReadonlyMap<YearMonth, FrozenMinimalMonthSource> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("La source Minimal historique certifiée est invalide.");
  }
  const rows = (value as { readonly rows?: unknown }).rows;
  if (!Array.isArray(rows)) {
    throw new TypeError("Les mois Minimal historiques certifiés sont absents.");
  }
  const parsed = new Map<YearMonth, FrozenMinimalMonthSource>();
  for (const candidate of rows as readonly FrozenRow[]) {
    const month = parseYearMonth(candidate.month);
    if (parsed.has(month)) {
      throw new TypeError(`Le mois Minimal certifié ${month} est dupliqué.`);
    }
    if (candidate.MethodVersion !== MINIMAL_MONTH_METHOD_VERSION) {
      throw new TypeError(`La MethodVersion Minimal certifiée de ${month} est incompatible.`);
    }
    const coverage = parseCoverage(candidate.coverage);
    if (candidate.availability === "unknown") {
      if (candidate.finalValue !== null) {
        throw new TypeError(`La valeur Minimal inconnue de ${month} doit rester null.`);
      }
      parsed.set(month, {
        kind: "minimal_month",
        availability: "unknown",
        support: parseSupport({ n: 0, unit: "month", level: "insufficient" }),
        coverage,
      });
      continue;
    }
    if (candidate.availability !== "known") {
      throw new TypeError(`L'availability Minimal certifiée de ${month} est invalide.`);
    }
    const neutralVariableComponents = parseComponents(candidate.neutralVariableComponents);
    const mandatoryMonthlyObligationsAndProvisions = parseComponents(
      candidate.mandatoryMonthlyObligationsAndProvisions,
    );
    const expectedValue = parseMoney(String(candidate.finalValue));
    calculateMinimalMonthCost({
      neutralVariableComponents,
      mandatoryMonthlyObligationsAndProvisions,
    });
    parsed.set(month, {
      kind: "minimal_month",
      availability: "known",
      neutralVariableComponents,
      mandatoryMonthlyObligationsAndProvisions,
      certifiedHistoricalValue: expectedValue,
      coverage,
    });
  }
  if (parsed.size !== 12) {
    throw new TypeError(`La source Minimal historique contient ${parsed.size} mois au lieu de 12.`);
  }
  return parsed;
}

const certifiedRows = parseFrozenRows(frozenData);

export const certifiedHistoricalMinimalSource: CertifiedHistoricalMinimalSource = {
  resolve: ({ month, scopeHash }) => {
    const row = certifiedRows.get(month);
    return row === undefined ? null : { ...row, scopeHash } as MinimalMonthSource;
  },
};
