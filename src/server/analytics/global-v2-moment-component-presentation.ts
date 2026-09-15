import "server-only";

import { canonicalSerializeGlobal } from "@/core/global-v2";
import type { Money } from "@/core/money";
import type { EconomicComponentSourceKind } from "@/analytics/facts";
import type { CanonicalRepository } from "@/server/canonical/repository";
import { optionalCanonicalString, type CanonicalRecord } from "@/server/canonical/record";
import { createHash } from "node:crypto";

export const GLOBAL_MOMENT_COMPONENT_PRESENTATION_VERSION = "global-moment-component-presentation@v1" as const;

export type GlobalMomentComponentLabelSource =
  | "ITEM"
  | "PRECISE_DESCRIPTION"
  | "PRECISE_TYPE"
  | "CANONICAL_MERCHANT"
  | "SUBCATEGORY"
  | "CATEGORY"
  | "BANK_LABEL"
  | "CONTEXTUAL_NOTE"
  | "SOURCE_GRAIN";

export type GlobalMomentComponentPresentationRow = {
  readonly momentRef: string;
  readonly componentRef: string;
  readonly canonicalComponentKey: string;
  readonly amount: Money;
  readonly sourceKind: EconomicComponentSourceKind;
  readonly primaryLabel: string;
  readonly labelSource: GlobalMomentComponentLabelSource;
  readonly sourceOperationRef?: string;
  readonly categoryRef?: string;
  readonly categoryLabel?: string;
  readonly subcategoryRef?: string;
  readonly subcategoryLabel?: string;
  readonly merchantRef?: string;
  readonly merchantLabel?: string;
  readonly causalRole?: string;
  readonly compositionGroup?: string;
  readonly evidenceRefs: readonly string[];
};

export type GlobalMomentComponentPresentationBundle = {
  readonly version: typeof GLOBAL_MOMENT_COMPONENT_PRESENTATION_VERSION;
  readonly rows: readonly GlobalMomentComponentPresentationRow[];
  readonly inputHash: string;
};

type RawComponent = {
  readonly momentRef: string;
  readonly componentRef: string;
  readonly canonicalComponentKey: string;
  readonly amount: Money;
  readonly sourceKind: EconomicComponentSourceKind;
  readonly sourceOperationRef?: string;
  readonly categoryRef?: string;
  readonly subcategoryRef?: string;
  readonly merchantRef?: string;
  readonly causalRole?: string;
  readonly compositionGroup?: string;
  readonly evidenceRefs: readonly string[];
};

const digest = (value: unknown): string => createHash("sha256").update(canonicalSerializeGlobal(value), "utf8").digest("hex");
const idFromRef = (value: string | undefined, prefix: string): string | undefined => value?.startsWith(prefix) ? value.slice(prefix.length) : undefined;
const label = (row: CanonicalRecord | undefined, keys: readonly string[]): string | undefined => row === undefined ? undefined : optionalCanonicalString(row, keys);
const indexed = (rows: readonly CanonicalRecord[], key: string): Map<string, CanonicalRecord> => new Map(rows.flatMap((row) => {
  const id = optionalCanonicalString(row, [key]);
  return id === undefined ? [] : [[id, row] as const];
}));

function rawComponents(m6: unknown): readonly RawComponent[] {
  if (m6 === null || typeof m6 !== "object" || !Array.isArray((m6 as { summaries?: unknown }).summaries)) throw new TypeError("GLOBAL_MOMENT_COMPONENT_PRESENTATION_M6_INVALID");
  return (m6 as { summaries: readonly unknown[] }).summaries.flatMap((summary) => {
    if (summary === null || typeof summary !== "object") return [];
    const record = summary as Record<string, unknown>;
    const moment = record.moment as Record<string, unknown> | undefined;
    const momentId = typeof moment?.momentId === "string" ? moment.momentId : undefined;
    if (momentId === undefined || !Array.isArray(record.causalComponents)) return [];
    return record.causalComponents.map((candidate) => {
      const component = candidate as Record<string, unknown>;
      if (typeof component.componentRef !== "string" || typeof component.canonicalComponentKey !== "string" || typeof component.amount !== "string" || typeof component.sourceKind !== "string" || !Array.isArray(component.evidenceRefs)) throw new TypeError("GLOBAL_MOMENT_COMPONENT_PRESENTATION_COMPONENT_INVALID");
      return {
        momentRef: `moment:${momentId}`,
        componentRef: component.componentRef,
        canonicalComponentKey: component.canonicalComponentKey,
        amount: component.amount as Money,
        sourceKind: component.sourceKind as EconomicComponentSourceKind,
        ...(typeof component.sourceOperationRef === "string" ? { sourceOperationRef: component.sourceOperationRef } : {}),
        ...(typeof component.categoryRef === "string" ? { categoryRef: component.categoryRef } : {}),
        ...(typeof component.subcategoryRef === "string" ? { subcategoryRef: component.subcategoryRef } : {}),
        ...(typeof component.merchantRef === "string" ? { merchantRef: component.merchantRef } : {}),
        ...(typeof component.causalRole === "string" ? { causalRole: component.causalRole } : {}),
        ...(typeof component.compositionGroup === "string" ? { compositionGroup: component.compositionGroup } : {}),
        evidenceRefs: [...new Set(component.evidenceRefs.filter((entry): entry is string => typeof entry === "string"))].sort((left, right) => left.localeCompare(right)),
      };
    });
  });
}

export async function resolveGlobalMomentComponentPresentation(input: {
  readonly repository: CanonicalRepository;
  readonly m6: unknown;
}): Promise<GlobalMomentComponentPresentationBundle> {
  const components = rawComponents(input.m6);
  const operationIds = [...new Set(components.flatMap(({ sourceOperationRef }) => {
    const id = idFromRef(sourceOperationRef, "operation:");
    return id === undefined ? [] : [id];
  }))].sort();
  const categoryIds = [...new Set(components.flatMap(({ categoryRef }) => {
    const id = idFromRef(categoryRef, "category:"); return id === undefined ? [] : [id];
  }))].sort();
  const subcategoryIds = [...new Set(components.flatMap(({ subcategoryRef }) => {
    const id = idFromRef(subcategoryRef, "subcategory:"); return id === undefined ? [] : [id];
  }))].sort();
  const merchantIds = [...new Set(components.flatMap(({ merchantRef }) => {
    const id = idFromRef(merchantRef, "merchant:"); return id === undefined ? [] : [id];
  }))].sort();
  const [operations, composition, categories, subcategories, merchants] = await Promise.all([
    input.repository.loadOperationsByIds(operationIds),
    input.repository.loadOperationCompositionRows(operationIds),
    input.repository.loadTaxonomyRows("categories", categoryIds),
    input.repository.loadTaxonomyRows("subcategories", subcategoryIds),
    input.repository.loadEntityRows("merchants", "merchant_id", merchantIds),
  ]);
  const operationById = indexed(operations, "operation_id");
  const allocationById = indexed(composition.allocations, "allocation_id");
  const itemById = indexed(composition.items, "item_id");
  const paymentById = indexed(composition.paymentComponents, "payment_component_id");
  const cashById = indexed(composition.cashUses, "cash_use_id");
  const categoryById = indexed(categories, "category_id");
  const subcategoryById = indexed(subcategories, "subcategory_id");
  const merchantById = indexed(merchants, "merchant_id");

  const rows = components.map((component): GlobalMomentComponentPresentationRow => {
    const operationId = idFromRef(component.sourceOperationRef, "operation:");
    const operation = operationId === undefined ? undefined : operationById.get(operationId);
    const allocationId = component.canonicalComponentKey.startsWith("allocation:") ? component.canonicalComponentKey.slice("allocation:".length) : undefined;
    const allocation = allocationId === undefined ? undefined : allocationById.get(allocationId);
    const exactItemId = label(allocation, ["item_id"]);
    const exactItem = exactItemId === undefined ? undefined : itemById.get(exactItemId);
    const cashId = component.canonicalComponentKey.startsWith("cash_use:") ? component.canonicalComponentKey.slice("cash_use:".length) : undefined;
    const cash = cashId === undefined ? undefined : cashById.get(cashId);
    const paymentId = component.canonicalComponentKey.startsWith("payment_component:") ? component.canonicalComponentKey.slice("payment_component:".length) : undefined;
    const payment = paymentId === undefined ? undefined : paymentById.get(paymentId);
    const categoryId = idFromRef(component.categoryRef, "category:");
    const subcategoryId = idFromRef(component.subcategoryRef, "subcategory:");
    const merchantId = idFromRef(component.merchantRef, "merchant:");
    const categoryLabel = label(categoryId === undefined ? undefined : categoryById.get(categoryId), ["nom_canonique"]);
    const subcategoryLabel = label(subcategoryId === undefined ? undefined : subcategoryById.get(subcategoryId), ["nom_canonique"]);
    const merchantLabel = label(merchantId === undefined ? undefined : merchantById.get(merchantId), ["nom_canonique"]);
    const candidates: readonly [GlobalMomentComponentLabelSource, string | undefined][] = component.sourceKind === "Allocation"
      ? [
          ["ITEM", label(exactItem, ["nom"])],
          ["PRECISE_DESCRIPTION", label(allocation, ["description_precise"])],
          ["PRECISE_TYPE", label(allocation, ["type_precis"])],
          ["CANONICAL_MERCHANT", merchantLabel], ["SUBCATEGORY", subcategoryLabel], ["CATEGORY", categoryLabel],
        ]
      : component.sourceKind === "Cash_economic_use"
        ? [
            ["PRECISE_TYPE", label(cash, ["type_precis"])], ["SUBCATEGORY", subcategoryLabel], ["CATEGORY", categoryLabel],
            ["CONTEXTUAL_NOTE", label(cash, ["note"])],
          ]
        : component.sourceKind === "Operation_parent"
          ? [
              ["PRECISE_DESCRIPTION", label(operation, ["description_precise"])], ["PRECISE_TYPE", label(operation, ["type_precis"])],
              ["CANONICAL_MERCHANT", merchantLabel], ["SUBCATEGORY", subcategoryLabel], ["CATEGORY", categoryLabel],
              ["BANK_LABEL", label(operation, ["libelle_bancaire", "libelle"])],
            ]
          : [
              ["PRECISE_DESCRIPTION", label(payment, ["description_precise"])], ["PRECISE_TYPE", label(payment, ["type_precis"])],
              ["SUBCATEGORY", subcategoryLabel], ["CATEGORY", categoryLabel], ["CANONICAL_MERCHANT", merchantLabel],
              ["SOURCE_GRAIN", label(exactItem, ["nom"])],
            ];
    const resolved = candidates.find(([, value]) => value !== undefined);
    if (resolved === undefined) throw new TypeError(`GLOBAL_MOMENT_COMPONENT_HUMAN_LABEL_MISSING:${component.componentRef}`);
    return {
      ...component,
      primaryLabel: resolved[1]!,
      labelSource: resolved[0],
      ...(categoryLabel === undefined ? {} : { categoryLabel }),
      ...(subcategoryLabel === undefined ? {} : { subcategoryLabel }),
      ...(merchantLabel === undefined ? {} : { merchantLabel }),
    };
  }).sort((left, right) => left.momentRef.localeCompare(right.momentRef) || left.componentRef.localeCompare(right.componentRef));
  if (new Set(rows.map(({ componentRef, momentRef }) => `${momentRef}:${componentRef}`)).size !== rows.length) throw new TypeError("GLOBAL_MOMENT_COMPONENT_PRESENTATION_DUPLICATE");
  const structural = { version: GLOBAL_MOMENT_COMPONENT_PRESENTATION_VERSION, rows };
  return { ...structural, inputHash: digest(structural) };
}
