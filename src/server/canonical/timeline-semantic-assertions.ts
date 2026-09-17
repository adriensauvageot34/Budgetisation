import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TIMELINE_SEMANTIC_TAXONOMY_VERSION,
  assertTimelineSemanticTaxonomyVersion,
  resolveTimelineSemanticClassification,
  type TimelineSemanticClassification,
} from "@/analytics/global-v2/timeline-semantic-taxonomy";
import type { AuthorizedRuntimeContext } from "./context";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TimelineSemanticVisibilityTier = "PRINCIPAL" | "EXTENDED";

export type TimelineSemanticEventRef =
  | Readonly<{ sourceKind: "MOMENT"; momentId: string }>
  | Readonly<{ sourceKind: "LIFE_EVENT"; lifeEventId: string }>;

export type TimelineEventSemanticAssertionDraft = Readonly<{
  assertionId: string;
  eventRef: TimelineSemanticEventRef;
  visibilityTier: TimelineSemanticVisibilityTier;
  closeFamilyKey: string;
  taxonomyVersion: typeof TIMELINE_SEMANTIC_TAXONOMY_VERSION;
  authority: string;
  provenance: string;
  evidenceRefs: readonly string[];
  sourceRevision: number;
  declaredAt: string;
  validatedAt: string;
}>;

export type TimelineEventSemanticAssertion = TimelineEventSemanticAssertionDraft &
  Readonly<{
    householdId: string;
    classification: TimelineSemanticClassification;
    isActive: true;
  }>;

type SemanticAssertionRow = Readonly<{
  timeline_event_semantic_assertion_id: unknown;
  household_id: unknown;
  moment_id: unknown;
  life_event_id: unknown;
  visibility_tier: unknown;
  close_family_key: unknown;
  taxonomy_version: unknown;
  authority: unknown;
  provenance: unknown;
  evidence_refs: unknown;
  source_revision: unknown;
  declared_at: unknown;
  validated_at: unknown;
  is_active: unknown;
}>;

function record(value: unknown, code: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError(code);
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, code: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new TypeError(code);
  return value;
}

function uuid(value: unknown, code: string): string {
  const parsed = nonEmptyString(value, code);
  if (!uuidPattern.test(parsed)) throw new TypeError(code);
  return parsed;
}

function instant(value: unknown, code: string): string {
  const parsed = nonEmptyString(value, code);
  if (!Number.isFinite(Date.parse(parsed))) throw new TypeError(code);
  return parsed;
}

function visibilityTier(value: unknown): TimelineSemanticVisibilityTier {
  if (value !== "PRINCIPAL" && value !== "EXTENDED") {
    throw new TypeError("TIMELINE_SEMANTIC_VISIBILITY_INVALID");
  }
  return value;
}

function evidenceRefs(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError("TIMELINE_SEMANTIC_EVIDENCE_INVALID");
  const refs = value.map((entry) => nonEmptyString(entry, "TIMELINE_SEMANTIC_EVIDENCE_INVALID"));
  if (new Set(refs).size !== refs.length) throw new TypeError("TIMELINE_SEMANTIC_EVIDENCE_DUPLICATE");
  return Object.freeze(refs);
}

function positiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError("TIMELINE_SEMANTIC_SOURCE_REVISION_INVALID");
  }
  return value;
}

function eventRef(momentId: unknown, lifeEventId: unknown): TimelineSemanticEventRef {
  const hasMoment = momentId !== null && momentId !== undefined;
  const hasLifeEvent = lifeEventId !== null && lifeEventId !== undefined;
  if (hasMoment === hasLifeEvent) throw new TypeError("TIMELINE_SEMANTIC_EVENT_XOR_INVALID");
  return hasMoment
    ? { sourceKind: "MOMENT", momentId: uuid(momentId, "TIMELINE_SEMANTIC_MOMENT_ID_INVALID") }
    : { sourceKind: "LIFE_EVENT", lifeEventId: uuid(lifeEventId, "TIMELINE_SEMANTIC_LIFE_EVENT_ID_INVALID") };
}

export function parseTimelineEventSemanticAssertionDraft(value: unknown): TimelineEventSemanticAssertionDraft {
  const input = record(value, "TIMELINE_SEMANTIC_ASSERTION_INVALID");
  const ref = record(input.eventRef, "TIMELINE_SEMANTIC_EVENT_REF_INVALID");
  const parsedEventRef = eventRef(ref.momentId, ref.lifeEventId);
  if (ref.sourceKind !== parsedEventRef.sourceKind) {
    throw new TypeError("TIMELINE_SEMANTIC_EVENT_REF_KIND_INVALID");
  }
  assertTimelineSemanticTaxonomyVersion(input.taxonomyVersion);
  const closeFamilyKey = nonEmptyString(input.closeFamilyKey, "TIMELINE_SEMANTIC_CLOSE_FAMILY_UNKNOWN");
  resolveTimelineSemanticClassification(closeFamilyKey, input.taxonomyVersion);
  const declaredAt = instant(input.declaredAt, "TIMELINE_SEMANTIC_DECLARED_AT_INVALID");
  const validatedAt = instant(input.validatedAt, "TIMELINE_SEMANTIC_VALIDATED_AT_INVALID");
  if (Date.parse(validatedAt) < Date.parse(declaredAt)) throw new TypeError("TIMELINE_SEMANTIC_VALIDATION_ORDER_INVALID");
  return {
    assertionId: uuid(input.assertionId, "TIMELINE_SEMANTIC_ASSERTION_ID_INVALID"),
    eventRef: parsedEventRef,
    visibilityTier: visibilityTier(input.visibilityTier),
    closeFamilyKey,
    taxonomyVersion: TIMELINE_SEMANTIC_TAXONOMY_VERSION,
    authority: nonEmptyString(input.authority, "TIMELINE_SEMANTIC_AUTHORITY_INVALID"),
    provenance: nonEmptyString(input.provenance, "TIMELINE_SEMANTIC_PROVENANCE_INVALID"),
    evidenceRefs: evidenceRefs(input.evidenceRefs),
    sourceRevision: positiveInteger(input.sourceRevision),
    declaredAt,
    validatedAt,
  };
}

export function parseTimelineEventSemanticAssertionRow(
  value: unknown,
  expectedHouseholdId: string,
): TimelineEventSemanticAssertion {
  const row = record(value, "TIMELINE_SEMANTIC_ROW_INVALID") as SemanticAssertionRow;
  const householdId = uuid(row.household_id, "TIMELINE_SEMANTIC_HOUSEHOLD_ID_INVALID");
  if (householdId !== expectedHouseholdId) throw new TypeError("TIMELINE_SEMANTIC_CROSS_HOUSEHOLD");
  if (row.is_active !== true) throw new TypeError("TIMELINE_SEMANTIC_ACTIVE_ROW_REQUIRED");
  const draft = parseTimelineEventSemanticAssertionDraft({
    assertionId: row.timeline_event_semantic_assertion_id,
    eventRef: {
      sourceKind: row.moment_id === null ? "LIFE_EVENT" : "MOMENT",
      momentId: row.moment_id,
      lifeEventId: row.life_event_id,
    },
    visibilityTier: row.visibility_tier,
    closeFamilyKey: row.close_family_key,
    taxonomyVersion: row.taxonomy_version,
    authority: row.authority,
    provenance: row.provenance,
    evidenceRefs: row.evidence_refs,
    sourceRevision: row.source_revision,
    declaredAt: row.declared_at,
    validatedAt: row.validated_at,
  });
  return {
    ...draft,
    householdId,
    classification: resolveTimelineSemanticClassification(draft.closeFamilyKey, draft.taxonomyVersion),
    isActive: true,
  };
}

const semanticAssertionSelection = [
  "timeline_event_semantic_assertion_id",
  "household_id",
  "moment_id",
  "life_event_id",
  "visibility_tier",
  "close_family_key",
  "taxonomy_version",
  "authority",
  "provenance",
  "evidence_refs",
  "source_revision",
  "declared_at",
  "validated_at",
  "is_active",
].join(",");

export class TimelineSemanticAssertionRepository {
  private readonly client: SupabaseClient;
  private readonly context: AuthorizedRuntimeContext;

  constructor(
    client: SupabaseClient,
    context: AuthorizedRuntimeContext,
  ) {
    this.client = client;
    this.context = context;
  }

  async readAllActive(): Promise<readonly TimelineEventSemanticAssertion[]> {
    const result = await this.client
      .from("timeline_event_semantic_assertions")
      .select(semanticAssertionSelection)
      .eq("household_id", this.context.householdId)
      .eq("is_active", true)
      .order("moment_id", { ascending: true, nullsFirst: false })
      .order("life_event_id", { ascending: true, nullsFirst: false });
    if (result.error !== null) throw new Error("TIMELINE_SEMANTIC_READ_FAILED");
    if (!Array.isArray(result.data)) throw new Error("TIMELINE_SEMANTIC_READ_FAILED");
    return result.data.map((row) => parseTimelineEventSemanticAssertionRow(row, this.context.householdId));
  }

  async readActive(ref: TimelineSemanticEventRef): Promise<TimelineEventSemanticAssertion | null> {
    let query = this.client
      .from("timeline_event_semantic_assertions")
      .select(semanticAssertionSelection)
      .eq("household_id", this.context.householdId)
      .eq("is_active", true);
    query = ref.sourceKind === "MOMENT"
      ? query.eq("moment_id", ref.momentId)
      : query.eq("life_event_id", ref.lifeEventId);
    const result = await query.maybeSingle();
    if (result.error !== null) throw new Error("TIMELINE_SEMANTIC_READ_FAILED");
    return result.data === null
      ? null
      : parseTimelineEventSemanticAssertionRow(result.data, this.context.householdId);
  }

  async activate(value: unknown): Promise<TimelineEventSemanticAssertion> {
    const draft = parseTimelineEventSemanticAssertionDraft(value);
    const result = await this.client.rpc("activate_timeline_event_semantic_assertion", {
      p_assertion_id: draft.assertionId,
      p_household_id: this.context.householdId,
      p_moment_id: draft.eventRef.sourceKind === "MOMENT" ? draft.eventRef.momentId : null,
      p_life_event_id: draft.eventRef.sourceKind === "LIFE_EVENT" ? draft.eventRef.lifeEventId : null,
      p_visibility_tier: draft.visibilityTier,
      p_close_family_key: draft.closeFamilyKey,
      p_taxonomy_version: draft.taxonomyVersion,
      p_authority: draft.authority,
      p_provenance: draft.provenance,
      p_evidence_refs: draft.evidenceRefs,
      p_source_revision: draft.sourceRevision,
      p_declared_at: draft.declaredAt,
      p_validated_at: draft.validatedAt,
    });
    if (result.error !== null || result.data !== draft.assertionId) {
      throw new Error("TIMELINE_SEMANTIC_ACTIVATION_FAILED");
    }
    const active = await this.readActive(draft.eventRef);
    if (active === null || active.assertionId !== draft.assertionId) {
      throw new Error("TIMELINE_SEMANTIC_ACTIVATION_READBACK_FAILED");
    }
    return active;
  }
}
