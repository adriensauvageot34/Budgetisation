import "server-only";
import { beforeN2Enabled } from "./before-n2-cutover";
import type { ComposerDraftResult, ComposerDraftSaveCommand } from "@/domain/phase2/planner/composer-draft-contract";
import type { PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import type { ComposerResponse } from "@/domain/phase2/planner/composer-ui-contract";
import { BEFORE_ADMISSION_BUDGET_MS, BEFORE_ADMISSION_MAX_BYTES, beforeAdmissionMessage, parseBeforeDraftAdmission } from "@/domain/phase2/planner/before-draft-contract";
import { plannerDigest, plannerKeys, plannerRecord, plannerUuid } from "@/domain/phase2/planner/json";
import { parsePlanSemanticState, semanticStateDigest } from "@/domain/phase2/planner/semantic-state";
import { handleComposerRequest } from "./composer-service";
import { readComposerDrafts, readDraftPlanBase, responseComposerDraft, type ComposerDraftScope } from "./composer-draft-service";

const issued = new WeakSet<object>();
export type AdmittedBeforeSave = Readonly<{ userId: string; householdId: string; command: ComposerDraftSaveCommand;
  basePlanId: string | null; expectedDigest: string; fingerprint: string }>;
export type BeforeDraftWriter = (admission: AdmittedBeforeSave) => Promise<{ data: unknown; error: { code?: string } | null }>;
export const isAdmittedBeforeSave = (value: object): value is AdmittedBeforeSave => issued.has(value);
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.freeze(value); for (const item of Object.values(value)) freeze(item); } return value; }
const fail = (code: string): ComposerDraftResult => ({ ok: false, code: "ADMISSION_REFUSED", message: beforeAdmissionMessage(code), latest: null });
const worldDigest = (world: unknown) => plannerDigest(JSON.parse(JSON.stringify(world)));

/** Called before legacy Save/replay. Only this module can issue the writer's in-process capability. */
export async function saveBeforeComposerDraft(scope: ComposerDraftScope, input: ComposerDraftSaveCommand): Promise<ComposerDraftResult> {
  if (!beforeN2Enabled()) return fail("COMPOSER_BEFORE_N2_DISABLED");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = performance.now() + BEFORE_ADMISSION_BUDGET_MS;
  const budget = () => { if (performance.now() >= deadline) throw new TypeError("BEFORE_ADMISSION_BUDGET"); };
  const expire = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new TypeError("BEFORE_ADMISSION_BUDGET")), BEFORE_ADMISSION_BUDGET_MS); });
  const bounded = <T>(promise: Promise<T>) => Promise.race([promise, expire]);
  try {
    const record = plannerRecord(input); plannerKeys(record, ["targetMonth", "expectedDraftId", "expectedDraftVersion", "expectedBaseRevisionId", "expectedBaseRevisionNumber", "requestId", "semanticState", "digest", "beforeAdmission"]);
    if (Buffer.byteLength(JSON.stringify(input)) > BEFORE_ADMISSION_MAX_BYTES) return fail("BEFORE_ADMISSION_SIZE");
    const command = structuredClone(input), trace = parseBeforeDraftAdmission(command.beforeAdmission);
    plannerUuid(scope.userId); plannerUuid(scope.householdId); plannerUuid(command.requestId);
    const final = parsePlanSemanticState(command.semanticState);
    if (final.targetMonth !== command.targetMonth || semanticStateDigest(final) !== command.digest) return fail("BEFORE_ADMISSION_RESULT_INVALID");
    const fingerprint = plannerDigest({ protocol: trace.version, userId: scope.userId, householdId: scope.householdId, command });
    const snapshot = await bounded(readComposerDrafts(scope, command.targetMonth)), active = snapshot.active;
    if (active?.lastMutationRequestId === command.requestId) {
      if (active.lastAdmissionFingerprint !== fingerprint || active.lastMutationKind !== "SAVE"
        || active.lastMutationExpectedVersion !== command.expectedDraftVersion || active.digest !== command.digest)
        return fail("BEFORE_ADMISSION_REQUEST_REUSED");
      return { ok: true, draft: active, replayed: true };
    }
    if ((active?.draftId ?? null) !== command.expectedDraftId || (active?.version ?? 0) !== command.expectedDraftVersion
      || active && active.digest !== trace.baseDigest) return { ok: false, code: "CONFLICT", message: beforeAdmissionMessage("BEFORE_ADMISSION_BASE_CHANGED"), latest: snapshot };
    if (snapshot.baseStale || snapshot.activePlanRevisionId !== command.expectedBaseRevisionId
      || snapshot.activePlanRevisionNumber !== command.expectedBaseRevisionNumber) return { ok: false, code: "BASE_STALE", message: beforeAdmissionMessage("BEFORE_ADMISSION_BASE_CHANGED"), latest: snapshot };
    const parentId = trace.parentContextOccurrenceId;
    if (!scope.before) return fail("BEFORE_ADMISSION_CHANNEL_UNAVAILABLE");
    const { deps, write } = scope.before;
    const world = await bounded(deps.readWorld(scope.householdId, command.targetMonth)); const authority = worldDigest(world);
    const pinned = { ...deps, readWorld: async () => world, readComposerWorld: undefined };
    // Same authoritative source as ordinary Composer opening: durable Draft, otherwise active Plan/empty owner state.
    const opening = active ? undefined : await bounded(handleComposerRequest(pinned, scope.householdId, { kind: "READ", sequence: 1, targetMonth: command.targetMonth }));
    if (opening && !opening.ok) return fail(opening.code);
    const source = active?.semanticState ?? (opening && opening.ok ? opening.model.semanticState : undefined);
    if (!source || semanticStateDigest(source) !== trace.baseDigest) return fail("BEFORE_ADMISSION_BASE_CHANGED");
    let state: PlanSemanticStateV1 = source;
    const initialDigest = semanticStateDigest(state);
    const parent = state.contexts.find(c => c.contextOccurrenceId === parentId);
    if (parent && (parent.templateKey !== "night-out" || (parent.fields.composerPresentation as { presetKey?: string } | undefined)?.presetKey !== "bar-apero")) return fail("BEFORE_ADMISSION_TARGET_INVALID");
    for (const step of trace.steps) {
      budget();
      if (step.sourceDigest !== semanticStateDigest(state)) return fail("BEFORE_ADMISSION_STEP_BASE_CHANGED");
      const operation = step.operation;
      if (operation.kind === "EDIT_CONTEXT") {
        const target = state.contexts.find(c => c.contextOccurrenceId === operation.contextOccurrenceId);
        if (!target || target.contextOccurrenceId === parentId || target.parentContextOccurrenceId != null || Object.hasOwn(target.fields, "beforeMoment")) return fail("BEFORE_ADMISSION_INDEPENDENT_TARGET_INVALID");
      }
      if (step.operation.kind === "PRESERVE") {
        const items = state.contexts.find(c => c.contextOccurrenceId === parentId)?.slotSelections.before?.items;
        const link = Array.isArray(items) ? items[0] : undefined;
        const refs = new Set([parentId, ...(link && typeof link === "object" && !Array.isArray(link) && link.kind === "CHILD_CONTEXT" ? [String(link.childContextOccurrenceId)] : [])]);
        if (!refs.has(step.operation.targetRef)) return fail("BEFORE_ADMISSION_TARGET_INVALID");
      }
      const response: ComposerResponse = await bounded(handleComposerRequest(pinned, scope.householdId,
        { ...step.operation, sequence: 1, targetMonth: command.targetMonth, draft: state }));
      budget(); if (!response.ok) return fail(response.code);
      state = response.model.semanticState;
    }
    if (plannerDigest(state) !== plannerDigest(final)) return fail("BEFORE_ADMISSION_MIXED_UNSUPPORTED");
    if (worldDigest(await bounded(deps.readWorld(scope.householdId, command.targetMonth))) !== authority) return fail("BEFORE_ADMISSION_AUTHORITY_CHANGED");
    budget();
    const base = await bounded(readDraftPlanBase(scope, command.targetMonth)); budget();
    const admitted = freeze({ userId: scope.userId, householdId: scope.householdId, command: { ...command, semanticState: final },
      basePlanId: base.planId, expectedDigest: initialDigest, fingerprint }); issued.add(admitted);
    // The five-second replay budget ends before SQL starts. SQL has its separate four-second timeout.
    if (timer) clearTimeout(timer);
    const result = await write(admitted);
    if (!result.error) { try { const saved = responseComposerDraft(result.data, command.targetMonth); if (saved.draft.digest === command.digest && saved.draft.lastAdmissionFingerprint === fingerprint) return { ok: true, ...saved }; } catch { /* Reconcile an absent/malformed response below. */ } }
    // A transport response can be lost after commit. Recognize only the same complete request.
    const after = await readComposerDrafts(scope, command.targetMonth);
    if (after.active?.lastAdmissionFingerprint === fingerprint && after.active.lastMutationRequestId === command.requestId
      && after.active.digest === command.digest) return { ok: true, draft: after.active, replayed: true };
    return { ok: false, code: result.error?.code === "40001" ? "CONFLICT" : result.error?.code === "42501" ? "ACCESS_DENIED" : "UNAVAILABLE",
      message: beforeAdmissionMessage("BEFORE_ADMISSION_WRITE_UNCONFIRMED"), latest: after };
  } catch (error) {
    return fail(error instanceof TypeError ? error.message : "BEFORE_ADMISSION_UNAVAILABLE");
  } finally { if (timer) clearTimeout(timer); }
}
