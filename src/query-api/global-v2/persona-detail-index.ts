import {
  personaTraitKindCatalog,
  type PersonaProfileOutput,
  type PersonaTemporalStatus,
  type PersonaTraitKind,
} from "../../analytics/global-v2/persona-signals";
import type { PersonId } from "../../core/identity";
import {
  createRuntimeSchema,
  hasOwn,
  parseStrictRecord,
  parseStringLiteral,
  requireProperty,
} from "../../core/validation";
import type { RuntimeSchema } from "../../core/validation";

export const PERSONA_DETAIL_INDEX_SCHEMA_VERSION = "persona-detail-index@v1" as const;
export const PERSONA_DETAIL_INDEX_SOFT_BUDGET_BYTES = 16 * 1024;
export const PERSONA_DETAIL_INDEX_PAYLOAD_BUDGET_BYTES = 32 * 1024;
export const PERSONA_DETAIL_INDEX_MAX_BLOCKS = 24;
export const PERSONA_DETAIL_INDEX_MAX_METRICS_PER_BLOCK = 3;
export const PERSONA_DETAIL_INDEX_MAX_ITEMS_PER_BLOCK = 6;
export const PERSONA_DETAIL_INDEX_MAX_REFS_PER_BLOCK = 6;

export const personaOwnerDetailResourceCatalog = Object.freeze([
  "analysis_global_category_need_detail",
  "analysis_global_economic_recurrence_detail",
  "analysis_global_routine_detail",
  "analysis_global_place_mobility_detail",
  "analysis_global_moment_experience_detail",
] as const);

export type PersonaOwnerDetailResource = (typeof personaOwnerDetailResourceCatalog)[number];

export type PublishedPersonaDetailSurfaceMetric = {
  readonly metricId: string;
  readonly labelKey: string;
  readonly displayValue: string;
};

export type PublishedPersonaDetailItem = {
  readonly itemId: string;
  readonly semanticKey: string;
  readonly kind: PersonaTraitKind;
  readonly temporalStatus?: PersonaTemporalStatus;
};

export type PersonaOwnerDetailRef = {
  readonly resource: PersonaOwnerDetailResource;
  readonly entityRef: string;
  readonly role: "PRIMARY" | "CONTEXT" | "HISTORY";
};

export type PublishedPersonaDetailBlock = {
  readonly blockId: string;
  readonly semanticKey: string;
  readonly kind: PersonaTraitKind;
  readonly temporalStatus?: PersonaTemporalStatus;
  readonly surfaceMetrics: readonly PublishedPersonaDetailSurfaceMetric[];
  readonly items: readonly PublishedPersonaDetailItem[];
  readonly detailRefs: readonly PersonaOwnerDetailRef[];
  readonly availability: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
};

export type PublishedPersonaDetailIndex = {
  readonly schemaVersion: typeof PERSONA_DETAIL_INDEX_SCHEMA_VERSION;
  readonly personId: PersonId;
  readonly blocks: readonly PublishedPersonaDetailBlock[];
};

const traitKinds = new Set<PersonaTraitKind>(personaTraitKindCatalog);
const ownerResources = new Set<PersonaOwnerDetailResource>(personaOwnerDetailResourceCatalog);
const temporalStatuses = new Set<PersonaTemporalStatus>(["STABLE", "EMERGING", "HISTORICAL", "PROJECT", "CHANGED", "UNKNOWN"]);

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) throw new TypeError(`${label}_INVALID`);
  return value;
}

function array<T>(value: unknown, parse: (entry: unknown, index: number) => T, label: string): readonly T[] {
  if (!Array.isArray(value)) throw new TypeError(`${label}_INVALID`);
  return value.map(parse);
}

function optional<T>(record: Readonly<Record<string, unknown>>, key: string, parse: (value: unknown) => T): T | undefined {
  return hasOwn(record, key) ? parse(record[key]) : undefined;
}

function assertCanonical<T>(values: readonly T[], identity: (value: T) => string, label: string): void {
  const identities = values.map(identity);
  if (new Set(identities).size !== identities.length || identities.some((value, index) => index > 0 && identities[index - 1]!.localeCompare(value) >= 0)) {
    throw new TypeError(`${label}_NON_CANONICAL`);
  }
}

function parseMetric(value: unknown): PublishedPersonaDetailSurfaceMetric {
  const record = parseStrictRecord(value, ["metricId", "labelKey", "displayValue"], "PublishedPersonaDetailSurfaceMetric");
  return {
    metricId: text(requireProperty(record, "metricId", "PublishedPersonaDetailSurfaceMetric"), "PublishedPersonaDetailSurfaceMetric.metricId"),
    labelKey: text(requireProperty(record, "labelKey", "PublishedPersonaDetailSurfaceMetric"), "PublishedPersonaDetailSurfaceMetric.labelKey"),
    displayValue: text(requireProperty(record, "displayValue", "PublishedPersonaDetailSurfaceMetric"), "PublishedPersonaDetailSurfaceMetric.displayValue"),
  };
}

function parseItem(value: unknown): PublishedPersonaDetailItem {
  const record = parseStrictRecord(value, ["itemId", "semanticKey", "kind", "temporalStatus"], "PublishedPersonaDetailItem");
  const temporalStatus = optional(record, "temporalStatus", (entry) => parseStringLiteral<PersonaTemporalStatus>(entry, temporalStatuses, "PublishedPersonaDetailItem.temporalStatus"));
  return {
    itemId: text(requireProperty(record, "itemId", "PublishedPersonaDetailItem"), "PublishedPersonaDetailItem.itemId"),
    semanticKey: text(requireProperty(record, "semanticKey", "PublishedPersonaDetailItem"), "PublishedPersonaDetailItem.semanticKey"),
    kind: parseStringLiteral<PersonaTraitKind>(requireProperty(record, "kind", "PublishedPersonaDetailItem"), traitKinds, "PublishedPersonaDetailItem.kind"),
    ...(temporalStatus === undefined ? {} : { temporalStatus }),
  };
}

function parseDetailRef(value: unknown): PersonaOwnerDetailRef {
  const record = parseStrictRecord(value, ["resource", "entityRef", "role"], "PersonaOwnerDetailRef");
  return {
    resource: parseStringLiteral<PersonaOwnerDetailResource>(requireProperty(record, "resource", "PersonaOwnerDetailRef"), ownerResources, "PersonaOwnerDetailRef.resource"),
    entityRef: text(requireProperty(record, "entityRef", "PersonaOwnerDetailRef"), "PersonaOwnerDetailRef.entityRef"),
    role: parseStringLiteral(requireProperty(record, "role", "PersonaOwnerDetailRef"), new Set(["PRIMARY", "CONTEXT", "HISTORY"] as const), "PersonaOwnerDetailRef.role"),
  };
}

function parseBlock(value: unknown): PublishedPersonaDetailBlock {
  const record = parseStrictRecord(value, ["blockId", "semanticKey", "kind", "temporalStatus", "surfaceMetrics", "items", "detailRefs", "availability"], "PublishedPersonaDetailBlock");
  const surfaceMetrics = array(requireProperty(record, "surfaceMetrics", "PublishedPersonaDetailBlock"), parseMetric, "PublishedPersonaDetailBlock.surfaceMetrics");
  const items = array(requireProperty(record, "items", "PublishedPersonaDetailBlock"), parseItem, "PublishedPersonaDetailBlock.items");
  const detailRefs = array(requireProperty(record, "detailRefs", "PublishedPersonaDetailBlock"), parseDetailRef, "PublishedPersonaDetailBlock.detailRefs");
  if (surfaceMetrics.length > PERSONA_DETAIL_INDEX_MAX_METRICS_PER_BLOCK) throw new TypeError("PERSONA_DETAIL_METRIC_LIMIT");
  if (items.length > PERSONA_DETAIL_INDEX_MAX_ITEMS_PER_BLOCK) throw new TypeError("PERSONA_DETAIL_ITEM_LIMIT");
  if (detailRefs.length > PERSONA_DETAIL_INDEX_MAX_REFS_PER_BLOCK) throw new TypeError("PERSONA_DETAIL_REF_LIMIT");
  assertCanonical(surfaceMetrics, ({ metricId }) => metricId, "PERSONA_DETAIL_METRICS");
  assertCanonical(items, ({ itemId }) => itemId, "PERSONA_DETAIL_ITEMS");
  assertCanonical(detailRefs, ({ resource, entityRef, role }) => `${resource}:${entityRef}:${role}`, "PERSONA_DETAIL_REFS");
  const temporalStatus = optional(record, "temporalStatus", (entry) => parseStringLiteral<PersonaTemporalStatus>(entry, temporalStatuses, "PublishedPersonaDetailBlock.temporalStatus"));
  return {
    blockId: text(requireProperty(record, "blockId", "PublishedPersonaDetailBlock"), "PublishedPersonaDetailBlock.blockId"),
    semanticKey: text(requireProperty(record, "semanticKey", "PublishedPersonaDetailBlock"), "PublishedPersonaDetailBlock.semanticKey"),
    kind: parseStringLiteral<PersonaTraitKind>(requireProperty(record, "kind", "PublishedPersonaDetailBlock"), traitKinds, "PublishedPersonaDetailBlock.kind"),
    ...(temporalStatus === undefined ? {} : { temporalStatus }),
    surfaceMetrics,
    items,
    detailRefs,
    availability: parseStringLiteral(requireProperty(record, "availability", "PublishedPersonaDetailBlock"), new Set(["AVAILABLE", "PARTIAL", "UNAVAILABLE"] as const), "PublishedPersonaDetailBlock.availability"),
  };
}

export function parsePublishedPersonaDetailIndex(value: unknown): PublishedPersonaDetailIndex {
  const record = parseStrictRecord(value, ["schemaVersion", "personId", "blocks"], "PublishedPersonaDetailIndex");
  const blocks = array(requireProperty(record, "blocks", "PublishedPersonaDetailIndex"), parseBlock, "PublishedPersonaDetailIndex.blocks");
  if (blocks.length > PERSONA_DETAIL_INDEX_MAX_BLOCKS) throw new TypeError("PERSONA_DETAIL_BLOCK_LIMIT");
  assertCanonical(blocks, ({ blockId }) => blockId, "PERSONA_DETAIL_BLOCKS");
  const parsed: PublishedPersonaDetailIndex = {
    schemaVersion: parseStringLiteral(requireProperty(record, "schemaVersion", "PublishedPersonaDetailIndex"), new Set([PERSONA_DETAIL_INDEX_SCHEMA_VERSION]), "PublishedPersonaDetailIndex.schemaVersion"),
    personId: text(requireProperty(record, "personId", "PublishedPersonaDetailIndex"), "PublishedPersonaDetailIndex.personId") as PersonId,
    blocks,
  };
  if (new TextEncoder().encode(JSON.stringify(parsed)).byteLength > PERSONA_DETAIL_INDEX_PAYLOAD_BUDGET_BYTES) throw new TypeError("PERSONA_DETAIL_PAYLOAD_BUDGET_EXCEEDED");
  return parsed;
}

export function projectPublishedPersonaDetailIndex(input: PersonaProfileOutput, personId: PersonId): PublishedPersonaDetailIndex {
  const profile = input.profiles.find((candidate) => candidate.scope === "PERSONAL" && candidate.subject.kind === "PERSON" && candidate.subject.personId === personId);
  if (profile === undefined) throw new TypeError("PERSONA_DETAIL_PERSON_PROFILE_MISSING");
  const featuredIds = new Set(profile.featuredTraits.map(({ traitId }) => traitId));
  const traits = [...new Map([
    ...profile.featuredTraits,
    ...profile.allTraits.filter(({ entityRefs }) => entityRefs?.some((entityRef) => entityRef.startsWith("need:")) === true),
  ].map((trait) => [trait.traitId, trait] as const)).values()]
    .sort((left, right) => Number(featuredIds.has(right.traitId)) - Number(featuredIds.has(left.traitId)) || left.traitId.localeCompare(right.traitId))
    .slice(0, PERSONA_DETAIL_INDEX_MAX_BLOCKS);
  return parsePublishedPersonaDetailIndex({
    schemaVersion: PERSONA_DETAIL_INDEX_SCHEMA_VERSION,
    personId,
    blocks: traits
      .map((trait) => {
        if (trait.scope !== "PERSONAL" || trait.subject.kind !== "PERSON" || trait.subject.personId !== personId) {
          throw new TypeError("PERSONA_DETAIL_SOURCE_SUBJECT_MISMATCH");
        }
        const surfaceMetrics = Object.entries(trait.metrics ?? {})
          .sort(([left], [right]) => left.localeCompare(right))
          .slice(0, PERSONA_DETAIL_INDEX_MAX_METRICS_PER_BLOCK)
          .map(([metricId, value]) => ({ metricId, labelKey: metricId, displayValue: String(value) }));
        const items = [...(trait.children ?? [])]
          .sort((left, right) => left.traitId.localeCompare(right.traitId))
          .slice(0, PERSONA_DETAIL_INDEX_MAX_ITEMS_PER_BLOCK)
          .map((child) => ({
            itemId: child.traitId,
            semanticKey: child.semanticKey,
            kind: child.kind,
            ...(child.temporalStatus === undefined ? {} : { temporalStatus: child.temporalStatus }),
          }));
        const detailRefs = [...new Set((trait.entityRefs ?? []).filter((entityRef) => entityRef.startsWith("need:")))]
          .sort()
          .slice(0, PERSONA_DETAIL_INDEX_MAX_REFS_PER_BLOCK)
          .map((entityRef) => ({ resource: "analysis_global_category_need_detail" as const, entityRef, role: "PRIMARY" as const }));
        return {
          blockId: trait.traitId,
          semanticKey: trait.semanticKey,
          kind: trait.kind,
          ...(trait.temporalStatus === undefined ? {} : { temporalStatus: trait.temporalStatus }),
          surfaceMetrics,
          items,
          detailRefs,
          availability: surfaceMetrics.length + items.length + detailRefs.length > 0 ? "AVAILABLE" : "PARTIAL",
        };
      }).sort((left, right) => left.blockId.localeCompare(right.blockId)),
  });
}

export const publishedPersonaDetailIndexSchema: RuntimeSchema<PublishedPersonaDetailIndex> = createRuntimeSchema(parsePublishedPersonaDetailIndex);
