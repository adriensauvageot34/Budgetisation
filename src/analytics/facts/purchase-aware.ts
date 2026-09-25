import { addMoney, compareMoney, parseMoney, type Money } from "../../core/money";
import type { HouseholdId, OperationId } from "../../core/identity";
import { addMonths, type LocalDate } from "../../core/time";
import {
  normalizeComponentClassificationValue,
  type ComponentAxisClassification,
  type ComponentClassificationAssertion,
  type PurchaseEventClassificationAssertion,
  type ComponentClassificationAxis,
} from "./component-classification";
import { resolvePurchaseEventTiming, type PurchaseEventTimingAssertion } from "./purchase-event";
import { parseCanonicalComponentKey } from "./validation";
import type { PurchaseEventCanonicalSource } from "./canonical";
import type {
  AnalyticDimensionValue,
  CanonicalComponentKey,
  EconomicComponentFact,
  EconomicComponentSourceKind,
  PurchaseEventTiming,
} from "./types";

export type EconomicAmountQuality =
  | { readonly status: "KNOWN"; readonly value: Money }
  | { readonly status: "LOWER_BOUND"; readonly minimum: Money }
  | { readonly status: "UNKNOWN" }
  | { readonly status: "CONFLICT"; readonly reason: string };

export function purchaseGrossAmount(
  status: "KNOWN" | "PARTIAL" | "UNKNOWN" | "CONFLICT",
  amount: string | null,
): EconomicAmountQuality {
  if (!["KNOWN", "PARTIAL", "UNKNOWN", "CONFLICT"].includes(status)) {
    throw new TypeError("Le statut du gross d'achat est invalide.");
  }
  if (status === "UNKNOWN" || status === "CONFLICT") {
    if (amount !== null) throw new TypeError("Un gross inconnu ou conflictuel ne porte pas de montant.");
    return status === "UNKNOWN" ? { status } : { status, reason: "PURCHASE_GROSS_CONFLICT" };
  }
  if (amount === null) throw new TypeError("Un gross connu ou partiel exige un montant.");
  const value = parseMoney(amount);
  if (compareMoney(value, parseMoney("0")) < 0) throw new TypeError("Le gross d'achat doit être positif.");
  return status === "KNOWN" ? { status, value } : { status: "LOWER_BOUND", minimum: value };
}

export function addEconomicAmounts(
  left: EconomicAmountQuality,
  right: EconomicAmountQuality,
): EconomicAmountQuality {
  if (left.status === "CONFLICT") return left;
  if (right.status === "CONFLICT") return right;
  if (left.status === "UNKNOWN" || right.status === "UNKNOWN") return { status: "UNKNOWN" };
  const sum = addMoney(
    left.status === "KNOWN" ? left.value : left.minimum,
    right.status === "KNOWN" ? right.value : right.minimum,
  );
  return left.status === "KNOWN" && right.status === "KNOWN"
    ? { status: "KNOWN", value: sum }
    : { status: "LOWER_BOUND", minimum: sum };
}

export type PurchaseEconomicOwner =
  | { readonly status: "RESOLVED"; readonly kind: "operation"; readonly canonicalComponentKey: CanonicalComponentKey; readonly operationId: OperationId }
  | { readonly status: "RESOLVED"; readonly kind: "purchase_component"; readonly canonicalComponentKey: CanonicalComponentKey; readonly purchaseComponentId: string }
  | { readonly status: "UNRESOLVED"; readonly reason: "NO_OWNER" }
  | { readonly status: "CONFLICT"; readonly reason: "MULTIPLE_OWNERS" | "UNSUPPORTED_OWNER" | "OWNER_KEY_MISMATCH" };

export function resolveEffectivePurchaseEconomicOwner(
  sources: readonly PurchaseEventCanonicalSource[],
): PurchaseEconomicOwner {
  const owners = sources.filter((source) => source.membershipKind === "CONSUMPTION_COMPONENT");
  if (owners.length === 0) return { status: "UNRESOLVED", reason: "NO_OWNER" };
  if (owners.length !== 1) return { status: "CONFLICT", reason: "MULTIPLE_OWNERS" };
  const owner = owners[0];
  const key = parseCanonicalComponentKey(owner.canonicalComponentKey);
  if (key !== `${owner.kind}:${owner.sourceId}`) {
    return { status: "CONFLICT", reason: "OWNER_KEY_MISMATCH" };
  }
  if (owner.kind === "operation") {
    return { status: "RESOLVED", kind: "operation", canonicalComponentKey: key, operationId: owner.sourceId as OperationId };
  }
  if (owner.kind === "purchase_component") {
    return { status: "RESOLVED", kind: "purchase_component", canonicalComponentKey: key, purchaseComponentId: owner.sourceId };
  }
  return { status: "CONFLICT", reason: "UNSUPPORTED_OWNER" };
}

export type PurchaseAwarePurchase = {
  readonly purchaseEventId: string;
  readonly householdId: HouseholdId;
  readonly grossAmount: string | null;
  readonly grossAmountStatus: "KNOWN" | "PARTIAL" | "UNKNOWN" | "CONFLICT";
  readonly sources: readonly PurchaseEventCanonicalSource[];
  readonly timingAssertions: readonly PurchaseEventTimingAssertion[];
  readonly nativeComponent?: {
    readonly purchaseComponentId: string;
    readonly canonicalComponentKey: CanonicalComponentKey;
    readonly purchaseEventId: string;
    readonly categoryId: string | null;
    readonly subcategoryId: string | null;
    readonly needId: string | null;
    readonly merchantId: string | null;
  };
  readonly bankAmount?: string | null;
  readonly operationCanonicalFactCount?: number;
  readonly operationOwnerSourceKind?: "Operation_parent" | "Operation_residual";
  readonly purchaseClassifications: readonly PurchaseEventClassificationAssertion[];
  readonly componentClassifications?: readonly ComponentClassificationAssertion[];
  readonly operationClassificationValues?: Readonly<Record<ComponentClassificationAxis, unknown>>;
  readonly operationTaxonomy?: {
    readonly categoryId: string | null;
    readonly subcategoryId: string | null;
    readonly needId: string | null;
    readonly merchantId: string | null;
  };
  readonly purchaseTaxonomy?: {
    readonly categoryId: string | null;
    readonly subcategoryId: string | null;
    readonly needId: string | null;
    readonly merchantId: string | null;
  };
  readonly semanticPurpose?: string | null;
};

export type PurchaseAwareEconomicFact = {
  readonly fact: "fct_purchase_aware_economic_component";
  readonly householdId: HouseholdId;
  readonly canonicalComponentKey: CanonicalComponentKey;
  readonly purchaseIdentityKey: string;
  readonly purchaseEventId: string;
  readonly sourceKind: EconomicComponentSourceKind;
  readonly sourceOperation: AnalyticDimensionValue<OperationId>;
  readonly economicAmount: EconomicAmountQuality;
  readonly bankAmount: EconomicAmountQuality | { readonly status: "NOT_APPLICABLE" };
  readonly taxonomy: {
    readonly categoryId: string | null;
    readonly subcategoryId: string | null;
    readonly needId: string | null;
    readonly merchantId: string | null;
  };
  readonly timing: PurchaseEventTiming;
  readonly semanticPurpose: string | null;
  readonly classification: Readonly<Record<"necessity" | "behavior" | "lifeScope", ComponentAxisClassification>>;
  readonly reconciliation: "PURCHASE_OWNER_RECONCILED" | "PURCHASE_OWNER_PARTIAL" | "PURCHASE_OWNER_UNKNOWN" | "PURCHASE_OWNER_CONFLICT";
};

export type PurchaseAwareCanonicalResult = {
  readonly visibility: "DEFAULT" | "PURCHASE_AWARE_PILOT";
  readonly status: "PASS" | "BLOCKED";
  readonly facts: readonly (EconomicComponentFact | PurchaseAwareEconomicFact)[];
  readonly blocking: readonly { readonly purchaseEventId: string; readonly reason: string }[];
};

export function purchaseIdentityKeyOfEconomicFact(
  fact: EconomicComponentFact | PurchaseAwareEconomicFact,
): string {
  if (fact.fact === "fct_purchase_aware_economic_component") return fact.purchaseIdentityKey;
  return fact.sourceOperation.kind === "resolved"
    ? `operation:${fact.sourceOperation.id}`
    : String(fact.canonicalComponentKey);
}

const unknownClassification: ComponentAxisClassification = {
  status: "UNKNOWN", value: null, authority: null, evidenceRefs: [], provenance: null,
};
const axisProperties = { NECESSITY: "necessity", BEHAVIOR: "behavior", LIFE_SCOPE: "lifeScope" } as const;

function purchaseClassifications(purchase: PurchaseAwarePurchase): PurchaseAwareEconomicFact["classification"] {
  const owner = resolveEffectivePurchaseEconomicOwner(purchase.sources);
  if (owner.status !== "RESOLVED") throw new TypeError("La classification exige un propriétaire résolu.");
  const operationId = owner.kind === "operation" ? owner.operationId : null;
  return Object.fromEntries((Object.keys(axisProperties) as ComponentClassificationAxis[]).map((axis) => {
    const assertions = purchase.purchaseClassifications.filter((row) =>
      row.purchaseEventId === purchase.purchaseEventId && row.axis === axis);
    if (assertions.length > 1) throw new TypeError("Une classification d'achat est dupliquée.");
    if (assertions.length === 1) return [axisProperties[axis], assertions[0].resolution];
    if (operationId !== null) {
      const componentAssertions = (purchase.componentClassifications ?? []).filter((row) =>
        row.canonicalComponentKey === owner.canonicalComponentKey && row.axis === axis);
      if (componentAssertions.length > 1) throw new TypeError("Une classification de composant est dupliquée.");
      if (componentAssertions.length === 1) return [axisProperties[axis], componentAssertions[0].resolution];
    }
    const value = operationId !== null
      ? normalizeComponentClassificationValue(axis, purchase.operationClassificationValues?.[axis])
      : null;
    return [axisProperties[axis], value === null ? unknownClassification : {
      status: "KNOWN", value, authority: "OPERATION_FALLBACK",
      evidenceRefs: [`operation:${operationId}:${axis}`], provenance: "STRUCTURED_CANONICAL_SOURCE",
    } satisfies ComponentAxisClassification];
  })) as PurchaseAwareEconomicFact["classification"];
}

function timingInRange(timing: PurchaseEventTiming, range: { readonly start: LocalDate; readonly endExclusive: LocalDate }): boolean {
  if (timing.economicMonth === null) return false;
  if (timing.economicDate !== null) {
    return timing.economicDate >= range.start && timing.economicDate < range.endExclusive;
  }
  const start = `${timing.economicMonth}-01`;
  const end = `${addMonths(timing.economicMonth, 1)}-01`;
  return start < range.endExclusive && end > range.start;
}

export function projectPurchaseAwareCanonical(input: {
  readonly visibility: "DEFAULT" | "PURCHASE_AWARE_PILOT";
  readonly householdId: HouseholdId;
  readonly range: { readonly start: LocalDate; readonly endExclusive: LocalDate };
  readonly legacyFacts: readonly EconomicComponentFact[];
  readonly purchases: readonly PurchaseAwarePurchase[];
}): PurchaseAwareCanonicalResult {
  if (input.visibility === "DEFAULT") {
    return { visibility: "DEFAULT", status: "PASS", facts: input.legacyFacts, blocking: [] };
  }
  const consumedOperations = new Set<string>();
  const consumedNativeKeys = new Set<string>();
  const blocking: { purchaseEventId: string; reason: string }[] = [];
  const purchaseFacts: PurchaseAwareEconomicFact[] = [];
  const purchaseIds = new Set<string>();
  for (const purchase of input.purchases) {
    if (purchaseIds.has(purchase.purchaseEventId)) throw new TypeError("Un PurchaseEvent pilote est dupliqué.");
    purchaseIds.add(purchase.purchaseEventId);
    if (purchase.householdId !== input.householdId) throw new TypeError("PurchaseEvent hors Household canonique.");
    const owner = resolveEffectivePurchaseEconomicOwner(purchase.sources);
    if (owner.status !== "RESOLVED") {
      blocking.push({ purchaseEventId: purchase.purchaseEventId, reason: owner.reason });
      continue;
    }
    if (owner.kind === "operation") {
      if (consumedOperations.has(owner.operationId)) {
        blocking.push({ purchaseEventId: purchase.purchaseEventId, reason: "DUPLICATE_OPERATION_OWNER" });
        continue;
      }
      consumedOperations.add(owner.operationId);
      if (purchase.bankAmount === undefined) {
        blocking.push({ purchaseEventId: purchase.purchaseEventId, reason: "OPERATION_NOT_RESOLVED" });
        continue;
      }
      if (purchase.operationCanonicalFactCount === 0) {
        blocking.push({ purchaseEventId: purchase.purchaseEventId, reason: "OPERATION_CANONICAL_OWNER_ABSENT" });
        continue;
      }
    } else {
      if (consumedNativeKeys.has(owner.canonicalComponentKey)) {
        blocking.push({ purchaseEventId: purchase.purchaseEventId, reason: "DUPLICATE_PURCHASE_COMPONENT" });
        continue;
      }
      consumedNativeKeys.add(owner.canonicalComponentKey);
      if (purchase.nativeComponent?.purchaseEventId !== purchase.purchaseEventId
        || purchase.nativeComponent.purchaseComponentId !== owner.purchaseComponentId
        || purchase.nativeComponent.canonicalComponentKey !== owner.canonicalComponentKey) {
        blocking.push({ purchaseEventId: purchase.purchaseEventId, reason: "PURCHASE_COMPONENT_NOT_RECONCILED" });
        continue;
      }
    }
    const timing = resolvePurchaseEventTiming(purchase.timingAssertions);
    if (timing.economicMonth === null) {
      blocking.push({ purchaseEventId: purchase.purchaseEventId, reason: "TIMING_UNRESOLVED" });
      continue;
    }
    if (!timingInRange(timing, input.range)) continue;
    const economicAmount = purchaseGrossAmount(purchase.grossAmountStatus, purchase.grossAmount);
    const bankAmount = owner.kind === "purchase_component"
      ? { status: "NOT_APPLICABLE" as const }
      : purchase.bankAmount === null
        ? { status: "UNKNOWN" as const }
        : { status: "KNOWN" as const, value: parseMoney(purchase.bankAmount!) };
    purchaseFacts.push({
      fact: "fct_purchase_aware_economic_component",
      householdId: input.householdId,
      canonicalComponentKey: owner.canonicalComponentKey,
      purchaseIdentityKey: `purchase:${purchase.purchaseEventId}`,
      purchaseEventId: purchase.purchaseEventId,
      sourceKind: owner.kind === "operation"
        ? purchase.operationOwnerSourceKind ?? "Operation_parent"
        : "Purchase_component",
      sourceOperation: owner.kind === "operation"
        ? { kind: "resolved", id: owner.operationId }
        : { kind: "not_applicable" },
      economicAmount,
      bankAmount,
      taxonomy: purchase.purchaseTaxonomy ?? (owner.kind === "operation"
        ? purchase.operationTaxonomy ?? { categoryId: null, subcategoryId: null, needId: null, merchantId: null }
        : {
          categoryId: purchase.nativeComponent?.categoryId ?? null,
          subcategoryId: purchase.nativeComponent?.subcategoryId ?? null,
          needId: purchase.nativeComponent?.needId ?? null,
          merchantId: purchase.nativeComponent?.merchantId ?? null,
        }),
      timing,
      semanticPurpose: purchase.semanticPurpose ?? null,
      classification: purchaseClassifications(purchase),
      reconciliation: economicAmount.status === "KNOWN" ? "PURCHASE_OWNER_RECONCILED"
        : economicAmount.status === "LOWER_BOUND" ? "PURCHASE_OWNER_PARTIAL"
          : economicAmount.status === "UNKNOWN" ? "PURCHASE_OWNER_UNKNOWN"
            : "PURCHASE_OWNER_CONFLICT",
    });
  }
  const legacy = input.legacyFacts.filter((fact) =>
    fact.sourceOperation.kind !== "resolved" || !consumedOperations.has(String(fact.sourceOperation.id)));
  return {
    visibility: "PURCHASE_AWARE_PILOT",
    status: blocking.length === 0 ? "PASS" : "BLOCKED",
    facts: [...legacy, ...purchaseFacts].sort((a, b) =>
      String(a.canonicalComponentKey).localeCompare(String(b.canonicalComponentKey))),
    blocking,
  };
}
