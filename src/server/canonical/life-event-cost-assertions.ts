import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TIMELINE_EVENT_COST_METHOD_VERSION,
  type LifeEventCostClosureAssertion,
  type LifeEventCostClosureStatus,
} from "@/analytics/global-v2/timeline-event-cost";
import { parseCanonicalComponentKey, type CanonicalComponentKey } from "@/analytics/facts";
import type { AuthorizedRuntimeContext } from "./context";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LifeEventCostAssertionDraft = Omit<LifeEventCostClosureAssertion, "householdId">;

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

function evidenceRefs(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError("LIFE_EVENT_COST_EVIDENCE_INVALID");
  const refs = value.map((entry) => nonEmptyString(entry, "LIFE_EVENT_COST_EVIDENCE_INVALID"));
  if (new Set(refs).size !== refs.length) throw new TypeError("LIFE_EVENT_COST_EVIDENCE_DUPLICATE");
  return Object.freeze(refs);
}

function closureStatus(value: unknown): LifeEventCostClosureStatus {
  if (value !== "COMPLETE" && value !== "EXPLICIT_EMPTY") throw new TypeError("LIFE_EVENT_COST_CLOSURE_STATUS_INVALID");
  return value;
}

function expectedComponentKeys(value: unknown): readonly CanonicalComponentKey[] {
  if (!Array.isArray(value)) throw new TypeError("LIFE_EVENT_COST_EXPECTED_KEYS_INVALID");
  const keys = value.map((entry) => parseCanonicalComponentKey(entry));
  if (keys.some((key) => key.startsWith("payment_component:"))) {
    throw new TypeError("LIFE_EVENT_COST_PAYMENT_COMPONENT_UNSUPPORTED");
  }
  const normalized = [...new Set(keys)].sort();
  if (normalized.length !== keys.length || normalized.some((key, index) => key !== keys[index])) {
    throw new TypeError("LIFE_EVENT_COST_EXPECTED_KEYS_NOT_CANONICAL");
  }
  return Object.freeze(normalized);
}

function positiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError("LIFE_EVENT_COST_SOURCE_REVISION_INVALID");
  }
  return value;
}

export function parseLifeEventCostAssertionDraft(value: unknown): LifeEventCostAssertionDraft {
  const input = record(value, "LIFE_EVENT_COST_ASSERTION_INVALID");
  if (input.methodVersion !== TIMELINE_EVENT_COST_METHOD_VERSION) {
    throw new TypeError("LIFE_EVENT_COST_METHOD_VERSION_INVALID");
  }
  const status = closureStatus(input.closureStatus);
  const keys = expectedComponentKeys(input.expectedComponentKeys);
  if ((status === "COMPLETE" && keys.length === 0) || (status === "EXPLICIT_EMPTY" && keys.length !== 0)) {
    throw new TypeError("LIFE_EVENT_COST_CLOSURE_SHAPE_INVALID");
  }
  const declaredAt = instant(input.declaredAt, "LIFE_EVENT_COST_DECLARED_AT_INVALID");
  const validatedAt = instant(input.validatedAt, "LIFE_EVENT_COST_VALIDATED_AT_INVALID");
  if (Date.parse(validatedAt) < Date.parse(declaredAt)) throw new TypeError("LIFE_EVENT_COST_VALIDATION_ORDER_INVALID");
  return {
    assertionId: uuid(input.assertionId, "LIFE_EVENT_COST_ASSERTION_ID_INVALID"),
    lifeEventId: uuid(input.lifeEventId, "LIFE_EVENT_COST_LIFE_EVENT_ID_INVALID"),
    closureStatus: status,
    expectedComponentKeys: keys,
    methodVersion: TIMELINE_EVENT_COST_METHOD_VERSION,
    authority: nonEmptyString(input.authority, "LIFE_EVENT_COST_AUTHORITY_INVALID"),
    evidenceRefs: evidenceRefs(input.evidenceRefs),
    provenance: nonEmptyString(input.provenance, "LIFE_EVENT_COST_PROVENANCE_INVALID"),
    sourceRevision: positiveInteger(input.sourceRevision),
    declaredAt,
    validatedAt,
  };
}

export function parseLifeEventCostAssertionRow(
  value: unknown,
  expectedHouseholdId: string,
): LifeEventCostClosureAssertion {
  const row = record(value, "LIFE_EVENT_COST_ROW_INVALID");
  const householdId = uuid(row.household_id, "LIFE_EVENT_COST_HOUSEHOLD_ID_INVALID");
  if (householdId !== expectedHouseholdId) throw new TypeError("LIFE_EVENT_COST_CROSS_HOUSEHOLD");
  if (row.is_active !== true) throw new TypeError("LIFE_EVENT_COST_ACTIVE_ROW_REQUIRED");
  const draft = parseLifeEventCostAssertionDraft({
    assertionId: row.life_event_cost_assertion_id,
    lifeEventId: row.life_event_id,
    closureStatus: row.closure_status,
    expectedComponentKeys: row.expected_component_keys,
    methodVersion: row.method_version,
    authority: row.authority,
    evidenceRefs: row.evidence_refs,
    provenance: row.provenance,
    sourceRevision: row.source_revision,
    declaredAt: row.declared_at,
    validatedAt: row.validated_at,
  });
  return { ...draft, householdId };
}

const costAssertionSelection = [
  "life_event_cost_assertion_id",
  "household_id",
  "life_event_id",
  "closure_status",
  "expected_component_keys",
  "method_version",
  "authority",
  "evidence_refs",
  "provenance",
  "source_revision",
  "declared_at",
  "validated_at",
  "is_active",
].join(",");

export class LifeEventCostAssertionRepository {
  private readonly client: SupabaseClient;
  private readonly context: AuthorizedRuntimeContext;

  constructor(client: SupabaseClient, context: AuthorizedRuntimeContext) {
    this.client = client;
    this.context = context;
  }

  async readActive(lifeEventId: string): Promise<LifeEventCostClosureAssertion | null> {
    const result = await this.client
      .from("life_event_cost_assertions")
      .select(costAssertionSelection)
      .eq("household_id", this.context.householdId)
      .eq("life_event_id", lifeEventId)
      .eq("is_active", true)
      .maybeSingle();
    if (result.error !== null) throw new Error("LIFE_EVENT_COST_ASSERTION_READ_FAILED");
    return result.data === null
      ? null
      : parseLifeEventCostAssertionRow(result.data, this.context.householdId);
  }

  async activate(value: unknown): Promise<LifeEventCostClosureAssertion> {
    const draft = parseLifeEventCostAssertionDraft(value);
    const result = await this.client.rpc("activate_life_event_cost_assertion", {
      p_assertion_id: draft.assertionId,
      p_household_id: this.context.householdId,
      p_life_event_id: draft.lifeEventId,
      p_closure_status: draft.closureStatus,
      p_expected_component_keys: draft.expectedComponentKeys,
      p_method_version: draft.methodVersion,
      p_authority: draft.authority,
      p_evidence_refs: draft.evidenceRefs,
      p_provenance: draft.provenance,
      p_source_revision: draft.sourceRevision,
      p_declared_at: draft.declaredAt,
      p_validated_at: draft.validatedAt,
    });
    if (result.error !== null || result.data !== draft.assertionId) {
      throw new Error("LIFE_EVENT_COST_ASSERTION_ACTIVATION_FAILED");
    }
    const active = await this.readActive(draft.lifeEventId);
    if (active === null || active.assertionId !== draft.assertionId) {
      throw new Error("LIFE_EVENT_COST_ASSERTION_ACTIVATION_READBACK_FAILED");
    }
    return active;
  }
}
