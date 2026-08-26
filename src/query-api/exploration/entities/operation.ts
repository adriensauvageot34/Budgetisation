import type {
  CategoryId,
  LifeEventId,
  MerchantId,
  MomentId,
  OperationId,
  PlaceId,
  SubcategoryId,
} from "../../../core/identity";
import {
  parseCategoryId,
  parseLifeEventId,
  parseMerchantId,
  parseMomentId,
  parseOperationId,
  parsePlaceId,
  parseSubcategoryId,
} from "../../../core/identity";
import { parseMoney, type Money } from "../../../core/money";
import { parseLocalDate, parseYearMonth, type LocalDate, type YearMonth } from "../../../core/time";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  requireProperty,
} from "../../../core/validation";
import type { EconomicTiming } from "../../../analytics/facts";
import { parseCanonicalComponentKey, parseCashUseId } from "../../../analytics/facts";
import type { QueryCapabilities } from "../../capabilities";
import { queryResourceKeys } from "../../request";
import type { EntityIdentity } from "../shared";
import { parseDisplayText, parseEntityCapabilities, parseEntityIdentity } from "../shared";

export type OperationBankTruth = {
  readonly bankDate: LocalDate;
  readonly label: string;
  readonly amount: Money;
  readonly accountRef?: string;
};

export type OperationEconomicTruth = {
  readonly state: "known" | "partial" | "unknown" | "conflict";
  readonly gross?: Money;
  readonly refundApplied?: Money;
  readonly net?: Money;
  readonly economicTiming?: EconomicTiming;
};

export type OperationClassification = {
  readonly category:
    | { readonly state: "resolved"; readonly categoryId: CategoryId; readonly subcategoryId?: SubcategoryId }
    | { readonly state: "undetermined" | "unknown" | "conflict" };
  readonly necessity?: string;
  readonly behavior?: string;
  readonly lifeScope?: string;
};

export type CanonicalRelation<Id extends string> =
  | { readonly state: "resolved"; readonly id: Id }
  | { readonly state: "unknown" | "not_applicable" | "conflict" };

export type OperationLinks = {
  readonly merchant: CanonicalRelation<MerchantId>;
  readonly place: CanonicalRelation<PlaceId>;
  readonly lifeEvents: readonly { readonly id: LifeEventId; readonly label: string }[];
  readonly moments: readonly MomentId[];
};

export type OperationCompositionEntry = {
  readonly id: string;
  readonly label?: string;
  readonly amount?: Money;
};

export type OperationComposition = {
  readonly allocations: readonly OperationCompositionEntry[];
  readonly items: readonly OperationCompositionEntry[];
  readonly paymentComponents: readonly OperationCompositionEntry[];
  readonly cashUses: readonly OperationCompositionEntry[];
};

export type OperationTraceability = {
  readonly canonicalComponentKeys: readonly string[];
  readonly dataState: "known" | "partial" | "conflict" | "unknown";
  readonly evidence: readonly {
    readonly sourceType: string;
    readonly sourceId: string;
  }[];
};

export type EntityOperationReadModel = {
  readonly id: OperationId;
  readonly identity: EntityIdentity;
  readonly bankTruth: OperationBankTruth;
  readonly economicTruth: OperationEconomicTruth;
  readonly classification: OperationClassification;
  readonly links: OperationLinks;
  readonly composition: OperationComposition;
  readonly traceability: OperationTraceability;
  readonly capabilities: QueryCapabilities;
};

function parseOpaque(value: unknown, name: string): string {
  return parseDisplayText(value, name);
}

function parseBankTruth(value: unknown): OperationBankTruth {
  const record = parseStrictRecord(value, ["bankDate", "label", "amount", "accountRef"], "OperationBankTruth");
  const accountRef = hasOwn(record, "accountRef") ? parseOpaque(record.accountRef, "accountRef") : undefined;
  return {
    bankDate: parseLocalDate(requireProperty(record, "bankDate", "OperationBankTruth")),
    label: parseDisplayText(requireProperty(record, "label", "OperationBankTruth"), "bank label"),
    amount: parseMoney(requireProperty(record, "amount", "OperationBankTruth")),
    ...(accountRef === undefined ? {} : { accountRef }),
  };
}

function parseTimingSegment(value: unknown) {
  const record = parseStrictRecord(
    value,
    ["segmentKey", "timingState", "periodStart", "periodEnd", "economicMonth", "amount"],
    "EconomicTimingSegment",
  );
  const timingState = requireProperty(record, "timingState", "EconomicTimingSegment");
  if (!(timingState === "known" || timingState === "partial" || timingState === "unknown")) {
    throw new TypeError("EconomicTimingSegment.timingState est invalide.");
  }
  const periodStart = requireProperty(record, "periodStart", "EconomicTimingSegment");
  const periodEnd = requireProperty(record, "periodEnd", "EconomicTimingSegment");
  const economicMonth = requireProperty(record, "economicMonth", "EconomicTimingSegment");
  return {
    segmentKey: parseOpaque(requireProperty(record, "segmentKey", "EconomicTimingSegment"), "segmentKey") as never,
    timingState,
    periodStart: periodStart === null ? null : parseLocalDate(periodStart),
    periodEnd: periodEnd === null ? null : parseLocalDate(periodEnd),
    economicMonth: economicMonth === null ? null : parseYearMonth(economicMonth),
    amount: parseMoney(requireProperty(record, "amount", "EconomicTimingSegment")),
  };
}

function parseEconomicTiming(value: unknown): EconomicTiming {
  const record = parseStrictRecord(value, ["kind", "segments"], "EconomicTiming");
  const kind = requireProperty(record, "kind", "EconomicTiming");
  if (kind === "unknown" || kind === "conflict") {
    if (hasOwn(record, "segments")) throw new TypeError("EconomicTiming indisponible ne porte pas de segments.");
    return { kind };
  }
  if (!(kind === "known" || kind === "partial")) throw new TypeError("EconomicTiming.kind est invalide.");
  const segments = requireProperty(record, "segments", "EconomicTiming");
  if (!Array.isArray(segments)) throw new TypeError("EconomicTiming.segments doit être un tableau.");
  return { kind, segments: segments.map(parseTimingSegment) } as EconomicTiming;
}

function parseEconomicTruth(value: unknown): OperationEconomicTruth {
  const record = parseStrictRecord(
    value,
    ["state", "gross", "refundApplied", "net", "economicTiming"],
    "OperationEconomicTruth",
  );
  const state = requireProperty(record, "state", "OperationEconomicTruth");
  if (!(state === "known" || state === "partial" || state === "unknown" || state === "conflict")) {
    throw new TypeError("OperationEconomicTruth.state est invalide.");
  }
  const gross = hasOwn(record, "gross") ? parseMoney(record.gross) : undefined;
  const refundApplied = hasOwn(record, "refundApplied") ? parseMoney(record.refundApplied) : undefined;
  const net = hasOwn(record, "net") ? parseMoney(record.net) : undefined;
  const economicTiming = hasOwn(record, "economicTiming") ? parseEconomicTiming(record.economicTiming) : undefined;
  if (state === "known" && (gross === undefined || refundApplied === undefined || net === undefined || economicTiming === undefined)) {
    throw new TypeError("OperationEconomicTruth known exige gross/refund/net/timing.");
  }
  if (state === "unknown" && (gross !== undefined || refundApplied !== undefined || net !== undefined || economicTiming !== undefined)) {
    throw new TypeError("OperationEconomicTruth unknown ne force aucune valeur.");
  }
  return {
    state,
    ...(gross === undefined ? {} : { gross }),
    ...(refundApplied === undefined ? {} : { refundApplied }),
    ...(net === undefined ? {} : { net }),
    ...(economicTiming === undefined ? {} : { economicTiming }),
  };
}

function parseClassification(value: unknown): OperationClassification {
  const record = parseStrictRecord(value, ["category", "necessity", "behavior", "lifeScope"], "OperationClassification");
  const categoryRecord = parseStrictRecord(
    requireProperty(record, "category", "OperationClassification"),
    ["state", "categoryId", "subcategoryId"],
    "OperationCategory",
  );
  const state = requireProperty(categoryRecord, "state", "OperationCategory");
  let category: OperationClassification["category"];
  if (state === "resolved") {
    category = {
      state,
      categoryId: parseCategoryId(requireProperty(categoryRecord, "categoryId", "OperationCategory")),
      ...(hasOwn(categoryRecord, "subcategoryId") ? { subcategoryId: parseSubcategoryId(categoryRecord.subcategoryId) } : {}),
    };
  } else if (state === "undetermined" || state === "unknown" || state === "conflict") {
    if (hasOwn(categoryRecord, "categoryId") || hasOwn(categoryRecord, "subcategoryId")) {
      throw new TypeError("Une catégorie non résolue ne porte pas d'ID arbitraire.");
    }
    category = { state };
  } else throw new TypeError("OperationCategory.state est invalide.");
  const optionalText = (key: "necessity" | "behavior" | "lifeScope") =>
    hasOwn(record, key) ? parseDisplayText(record[key], `classification.${key}`) : undefined;
  const necessity = optionalText("necessity");
  const behavior = optionalText("behavior");
  const lifeScope = optionalText("lifeScope");
  return {
    category,
    ...(necessity === undefined ? {} : { necessity }),
    ...(behavior === undefined ? {} : { behavior }),
    ...(lifeScope === undefined ? {} : { lifeScope }),
  };
}

function parseRelation<Id extends string>(value: unknown, parseId: (raw: unknown) => Id): CanonicalRelation<Id> {
  const record = parseStrictRecord(value, ["state", "id"], "CanonicalRelation");
  const state = requireProperty(record, "state", "CanonicalRelation");
  if (state === "resolved") return { state, id: parseId(requireProperty(record, "id", "CanonicalRelation")) };
  if (state === "unknown" || state === "not_applicable" || state === "conflict") {
    if (hasOwn(record, "id")) throw new TypeError("Une relation non résolue ne choisit aucun ID.");
    return { state };
  }
  throw new TypeError("CanonicalRelation.state est invalide.");
}

function parseUniqueIds<Id extends string>(value: unknown, parseId: (raw: unknown) => Id, name: string): readonly Id[] {
  if (!Array.isArray(value)) throw new TypeError(`${name} doit être un tableau.`);
  const ids = value.map(parseId);
  if (new Set(ids).size !== ids.length) throw new TypeError(`${name} contient un doublon.`);
  return ids;
}

function parseLinks(value: unknown): OperationLinks {
  const record = parseStrictRecord(value, ["merchant", "place", "lifeEvents", "moments"], "OperationLinks");
  const rawLifeEvents = requireProperty(record, "lifeEvents", "OperationLinks");
  if (!Array.isArray(rawLifeEvents)) throw new TypeError("lifeEvents doit être un tableau.");
  const lifeEvents = rawLifeEvents.map((value) => {
    const item = parseStrictRecord(value, ["id", "label"], "OperationLifeEvent");
    return {
      id: parseLifeEventId(requireProperty(item, "id", "OperationLifeEvent")),
      label: parseDisplayText(requireProperty(item, "label", "OperationLifeEvent"), "OperationLifeEvent.label"),
    };
  });
  if (new Set(lifeEvents.map(({ id }) => id)).size !== lifeEvents.length) throw new TypeError("lifeEvents contient un doublon.");
  return {
    merchant: parseRelation(requireProperty(record, "merchant", "OperationLinks"), parseMerchantId),
    place: parseRelation(requireProperty(record, "place", "OperationLinks"), parsePlaceId),
    lifeEvents,
    moments: parseUniqueIds(requireProperty(record, "moments", "OperationLinks"), parseMomentId, "moments"),
  };
}

function parseCompositionEntry(value: unknown, kind: string): OperationCompositionEntry {
  const record = parseStrictRecord(value, ["id", "label", "amount"], `OperationComposition.${kind}`);
  const label = hasOwn(record, "label") ? parseDisplayText(record.label, `${kind}.label`) : undefined;
  const amount = hasOwn(record, "amount") ? parseMoney(record.amount) : undefined;
  const rawId = requireProperty(record, "id", `OperationComposition.${kind}`);
  const id = kind === "cashUses" ? (parseCashUseId(rawId) as string) : parseOpaque(rawId, `${kind}.id`);
  return { id, ...(label === undefined ? {} : { label }), ...(amount === undefined ? {} : { amount }) };
}

function parseComposition(value: unknown): OperationComposition {
  const record = parseStrictRecord(value, ["allocations", "items", "paymentComponents", "cashUses"], "OperationComposition");
  const parseEntries = (key: keyof OperationComposition) => {
    const raw = requireProperty(record, key, "OperationComposition");
    if (!Array.isArray(raw)) throw new TypeError(`OperationComposition.${key} doit être un tableau.`);
    return raw.map((entry) => parseCompositionEntry(entry, key));
  };
  return {
    allocations: parseEntries("allocations"),
    items: parseEntries("items"),
    paymentComponents: parseEntries("paymentComponents"),
    cashUses: parseEntries("cashUses"),
  };
}

function parseTraceability(value: unknown): OperationTraceability {
  const record = parseStrictRecord(value, ["canonicalComponentKeys", "dataState", "evidence"], "OperationTraceability");
  const rawKeys = requireProperty(record, "canonicalComponentKeys", "OperationTraceability");
  if (!Array.isArray(rawKeys)) throw new TypeError("canonicalComponentKeys doit être un tableau.");
  const canonicalComponentKeys = rawKeys.map((key) => parseCanonicalComponentKey(key) as string);
  if (new Set(canonicalComponentKeys).size !== canonicalComponentKeys.length) throw new TypeError("canonicalComponentKeys contient un doublon.");
  const dataState = requireProperty(record, "dataState", "OperationTraceability");
  if (!(dataState === "known" || dataState === "partial" || dataState === "conflict" || dataState === "unknown")) {
    throw new TypeError("OperationTraceability.dataState est invalide.");
  }
  const rawEvidence = requireProperty(record, "evidence", "OperationTraceability");
  if (!Array.isArray(rawEvidence)) throw new TypeError("OperationTraceability.evidence doit être un tableau.");
  const evidence = rawEvidence.map((item) => {
    const candidate = parseStrictRecord(item, ["sourceType", "sourceId"], "OperationEvidence");
    return {
      sourceType: parseOpaque(requireProperty(candidate, "sourceType", "OperationEvidence"), "sourceType"),
      sourceId: parseOpaque(requireProperty(candidate, "sourceId", "OperationEvidence"), "sourceId"),
    };
  });
  return { canonicalComponentKeys, dataState, evidence };
}

export function parseEntityOperationReadModel(value: unknown): EntityOperationReadModel {
  const record = parseStrictRecord(
    value,
    ["id", "identity", "bankTruth", "economicTruth", "classification", "links", "composition", "traceability", "capabilities"],
    "EntityOperationReadModel",
  );
  return {
    id: parseOperationId(requireProperty(record, "id", "EntityOperationReadModel")),
    identity: parseEntityIdentity(requireProperty(record, "identity", "EntityOperationReadModel")),
    bankTruth: parseBankTruth(requireProperty(record, "bankTruth", "EntityOperationReadModel")),
    economicTruth: parseEconomicTruth(requireProperty(record, "economicTruth", "EntityOperationReadModel")),
    classification: parseClassification(requireProperty(record, "classification", "EntityOperationReadModel")),
    links: parseLinks(requireProperty(record, "links", "EntityOperationReadModel")),
    composition: parseComposition(requireProperty(record, "composition", "EntityOperationReadModel")),
    traceability: parseTraceability(requireProperty(record, "traceability", "EntityOperationReadModel")),
    capabilities: parseEntityCapabilities(requireProperty(record, "capabilities", "EntityOperationReadModel"), queryResourceKeys.entityOperation),
  };
}

export const entityOperationReadModelSchema = createRuntimeSchema(parseEntityOperationReadModel);
