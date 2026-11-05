import type { ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import type { ComposerDraftSaveCommand, StoredComposerDraft } from "@/domain/phase2/planner/composer-draft-contract";
import { BEFORE_ADMISSION_MAX_STEPS, BEFORE_ADMISSION_VERSION, hasBeforeDraft, isBeforeN2Operation, parseBeforeDraftAdmission, type BeforeAdmissionStep, type BeforeDraftAdmission, type BeforeOperation } from "@/domain/phase2/planner/before-draft-contract";
import { plannerDigest, type PlannerJson } from "@/domain/phase2/planner/json";
import { semanticStateDigest, type PlanSemanticStateV1 } from "@/domain/phase2/planner/semantic-state";
import { barBefore, barBeforeMomentPatch } from "./bar-before";
import type { BeforeMomentEdit } from "@/domain/phase2/planner/before-moment";
import { editNightOut, type NightOutEdit } from "@/domain/phase2/planner/night-out-edit";
import { nightOutConsumption, nightOutExtras } from "@/domain/phase2/planner/night-out-consumption";

type TraceFrame = { steps: BeforeAdmissionStep[]; parentId: string | null; blocked: string | null; baseKey: string };
type Edge = { before: PlanSemanticStateV1; after: PlanSemanticStateV1; operation: BeforeOperation };
/** Bounded N2 history metadata. Inverses use the original edge's IDs, never a new current child. */
export class BeforeDraftHistory {
  private durable: StoredComposerDraft | null;
  private baseState: PlanSemanticStateV1;
  private current: PlanSemanticStateV1;
  private steps: BeforeAdmissionStep[] = [];
  private parentId: string | null = null;
  private blocked: string | null = null;
  private frames = new Map<string, TraceFrame>();
  private edges: Edge[] = [];
  constructor(durable: StoredComposerDraft | null, initial: PlanSemanticStateV1) {
    this.durable = durable; this.baseState = durable?.semanticState ?? initial; this.current = initial; this.initialise();
  }
  private key() { return (this.durable?.draftId ?? "PLAN") + ":" + (this.durable?.version ?? 0) + ":" + semanticStateDigest(this.baseState); }
  private initialise() {
    const parents = [...new Set(this.current.contexts.filter(c => Object.hasOwn(c.fields, "beforeMoment")).map(c => c.parentContextOccurrenceId))];
    this.parentId = parents.length === 1 ? parents[0] ?? null : null;
    if (semanticStateDigest(this.baseState) !== semanticStateDigest(this.current)) this.blocked = "BEFORE_ADMISSION_BASE_CHANGED";
    this.remember();
  }
  /** An explicit authenticated base replacement invalidates every old history edge. */
  replaceBase(durable: StoredComposerDraft | null, selected: PlanSemanticStateV1) {
    this.durable = durable; this.baseState = durable?.semanticState ?? selected; this.current = selected;
    this.steps = []; this.blocked = null; this.frames.clear(); this.edges = []; this.initialise();
  }
  private remember() {
    const digest = semanticStateDigest(this.current);
    if (!this.frames.has(digest) && this.frames.size > BEFORE_ADMISSION_MAX_STEPS) this.frames.delete(this.frames.keys().next().value!);
    this.frames.set(digest, structuredClone({ steps: this.steps, parentId: this.parentId, blocked: this.blocked, baseKey: this.key() }));
  }
  private required(state = this.current) {
    return !!this.durable?.beforeAdmissionRequired || hasBeforeDraft(this.baseState) || hasBeforeDraft(state)
      || this.steps.some(s => isBeforeN2Operation(s.operation));
  }
  record(before: PlanSemanticStateV1, next: PlanSemanticStateV1, operation: ComposerOperation) {
    if (semanticStateDigest(before) === semanticStateDigest(next)) return;
    if (semanticStateDigest(before) !== semanticStateDigest(this.current)) this.blocked = "BEFORE_ADMISSION_HISTORY_CHANGED";
    let supported = false;
    if (operation.kind === "EDIT_NIGHT_OUT") {
      if (this.parentId && this.parentId !== operation.edit.contextOccurrenceId) this.blocked = "BEFORE_ADMISSION_MIXED_UNSUPPORTED";
      this.parentId ??= operation.edit.contextOccurrenceId; supported = true;
    } else if (operation.kind === "DROP" && operation.assetKey === "template:night-out" && operation.presetKey === "bar-apero" && operation.target.kind === "BOARD_ZONE") {
      if (this.parentId && this.parentId !== operation.identity) this.blocked = "BEFORE_ADMISSION_MIXED_UNSUPPORTED";
      this.parentId ??= operation.identity; supported = true;
    } else if (operation.kind === "EDIT_CONTEXT" || operation.kind === "PRESERVE") supported = true;
    if (!supported) this.blocked = "BEFORE_ADMISSION_MIXED_UNSUPPORTED";
    if (supported && this.steps.length < BEFORE_ADMISSION_MAX_STEPS) {
      const op = structuredClone(operation) as BeforeOperation;
      this.steps.push({ sourceDigest: semanticStateDigest(before), operation: op });
      this.edges.push({ before, after: next, operation: op });
      if (this.edges.length > BEFORE_ADMISSION_MAX_STEPS) this.edges.shift(); // Bound retained history, never the submitted decision trace.
    } else if (supported) this.blocked = "BEFORE_ADMISSION_LIMIT";
    this.current = next; this.remember();
  }
  select(next: PlanSemanticStateV1) {
    const known = this.frames.get(semanticStateDigest(next));
    if (known?.baseKey === this.key()) {
      this.steps = structuredClone(known.steps); this.parentId = known.parentId; this.blocked = known.blocked; this.current = next; return;
    }
    this.rebuild(next);
  }
  /** Leave the selected frame and its history intact when no durable inverse exists. */
  selectForSave(next: PlanSemanticStateV1): boolean {
    const { current, steps, parentId, blocked, frames } = this;
    this.frames = new Map(frames);
    try {
      this.select(next);
      if (semanticStateDigest(next) !== semanticStateDigest(this.baseState)) this.envelope(next);
      return true;
    } catch {
      this.current = current;
      this.steps = steps;
      this.parentId = parentId;
      this.blocked = blocked;
      this.frames = frames;
      return false;
    }
  }

  private inverse(edge: Edge): BeforeOperation {
    const op = edge.operation, prior = edge.before, after = edge.after;
    if (op.kind === "PRESERVE") {
      const value = prior.preferences.flexibility[op.targetRef];
      if (value !== "PRESERVE" && value !== "NORMAL") throw new TypeError("BEFORE_ADMISSION_HISTORY_OWNER_REQUIRED");
      return { ...op, preserve: value === "PRESERVE" };
    }
    if (op.kind === "EDIT_CONTEXT") {
      const target = prior.contexts.find(c => c.contextOccurrenceId === op.contextOccurrenceId);
      if (!target) throw new TypeError("BEFORE_ADMISSION_HISTORY_OWNER_REQUIRED");
      return { ...op, values: Object.fromEntries(Object.keys(op.values).map(k => [k, target.fields[k] ?? ""])) };
    }
    if (op.kind === "DROP") {
      if (op.target.kind !== "BOARD_ZONE") throw new TypeError("BEFORE_ADMISSION_HISTORY_OWNER_REQUIRED");
      return { kind: "DROP", assetKey: "context-occurrence:" + op.identity, identity: op.identity, selectionId: op.selectionId, target: { kind: "TRASH" }, values: {} };
    }
    const parent = prior.contexts.find(c => c.contextOccurrenceId === op.edit.contextOccurrenceId);
    const afterParent = after.contexts.find(c => c.contextOccurrenceId === op.edit.contextOccurrenceId);
    if (!parent || !afterParent) throw new TypeError("BEFORE_ADMISSION_HISTORY_OWNER_REQUIRED");
    if (op.edit.consumption || op.edit.globalConsumption || op.edit.coverageReplacement) {
      const mode = nightOutConsumption(parent);
      let edit: NightOutEdit;
      if (op.edit.consumption && mode?.version === "night-out-consumption@v1") {
        const direct = nightOutExtras(parent).find(item => item.selectionId === mode.directSelectionId);
        edit = { contextOccurrenceId: parent.contextOccurrenceId, fields: {}, consumption: {
          expectedContextDigest: plannerDigest(afterParent), mode: mode.mode,
          ...(mode.mode === "DIRECT" && direct?.kind === "COMPONENT" && direct.cost.kind === "MANUAL"
            ? { amount: direct.cost.unitAmount } : {}) } };
      } else if (op.edit.globalConsumption && mode?.version === "night-out-consumption@v2") {
        edit = { contextOccurrenceId: parent.contextOccurrenceId, fields: {}, globalConsumption: {
          version: "night-out-consumption@v2", expectedStateDigest: plannerDigest(after), mode: mode.mode,
          amount: mode.amount, selectionId: mode.globalSelectionId, confirmed: true } };
      } else if (op.edit.coverageReplacement && op.edit.slots) {
        // The existing slot owner can restore the observed aggregate and its original IDs.
        edit = { contextOccurrenceId: parent.contextOccurrenceId, fields: {}, slots:
          Object.fromEntries(Object.keys(op.edit.slots).map(key => [key, parent.slotSelections[key]?.items ?? []])) };
      } else throw new TypeError("BEFORE_ADMISSION_HISTORY_OWNER_REQUIRED");
      // An inverse is usable only if the existing owner reproduces the entire preimage.
      // Initial mode adoption can leave retained metadata; never erase it with a snapshot patch.
      try { if (semanticStateDigest(editNightOut(after, edit)) !== semanticStateDigest(prior)) throw new TypeError(); }
      catch { throw new TypeError("BEFORE_ADMISSION_HISTORY_OWNER_REQUIRED"); }
      return { kind: "EDIT_NIGHT_OUT", edit };
    }
    const fields = Object.fromEntries(Object.keys(op.edit.fields).map(k => [k, Object.hasOwn(parent.fields, k) ? parent.fields[k] : ""]));
    const slots = op.edit.slots ? Object.fromEntries(Object.keys(op.edit.slots).map(k => [k, parent.slotSelections[k]?.items ?? []])) : undefined;
    let edit: Extract<BeforeOperation, { kind: "EDIT_NIGHT_OUT" }>["edit"] = { contextOccurrenceId: parent.contextOccurrenceId, fields, ...(slots ? { slots } : {}) };
    if (Object.hasOwn(op.edit, "before")) {
      const wanted = barBefore(prior, parent), command = op.edit.before;
      if (!wanted) {
        if (!command || !("version" in command) || command.version !== "before-moment-edit@v1") throw new TypeError("BEFORE_ADMISSION_HISTORY_OWNER_REQUIRED");
        edit = { ...edit, before: { version: "before-moment-remove@v1", expectedStateDigest: plannerDigest(after),
          parentContextOccurrenceId: parent.contextOccurrenceId, childContextOccurrenceId: command.childContextOccurrenceId, selectionId: command.selectionId } };
      } else {
        const current = barBefore(after, afterParent), beforeFields: Record<string, PlannerJson> = {};
        for (const k of ["label", "plannedDate", "placeRef", "participantRefs"]) {
          if (Object.hasOwn(wanted.child.fields, k)) beforeFields[k] = wanted.child.fields[k];
          else if (current && Object.hasOwn(current.child.fields, k)) beforeFields[k] = "";
        }
        const patch = barBeforeMomentPatch(after, afterParent, wanted.bottle as Parameters<typeof barBeforeMomentPatch>[2], wanted.extras as Parameters<typeof barBeforeMomentPatch>[3], beforeFields);
        if (patch.kind !== "EDIT_NIGHT_OUT") throw new TypeError("BEFORE_ADMISSION_HISTORY_OWNER_REQUIRED");
        edit = { ...edit, before: { ...patch.edit.before as BeforeMomentEdit, childContextOccurrenceId: wanted.child.contextOccurrenceId, selectionId: wanted.link.selectionId } };
      }
    }
    return { kind: "EDIT_NIGHT_OUT", edit };
  }
  private rebuild(target: PlanSemanticStateV1) {
    this.current = target; this.steps = []; this.blocked = null;
    try {
      const start = semanticStateDigest(this.baseState), end = semanticStateDigest(target);
      if (!this.frames.has(start) || !this.frames.has(end)) throw new TypeError("BEFORE_ADMISSION_HISTORY_UNKNOWN_BASE");
      type Hop = { edge: Edge; reverse: boolean };
      const queue: { digest: string; path: Hop[] }[] = [{ digest: start, path: [] }], seen = new Set([start]);
      let selected: Hop[] | undefined;
      for (let i = 0; i < queue.length; i++) {
        const visit = queue[i]; if (visit.digest === end) { selected = visit.path; break; }
        for (const edge of this.edges) for (const reverse of [false, true]) {
          const source = semanticStateDigest(reverse ? edge.after : edge.before), destination = semanticStateDigest(reverse ? edge.before : edge.after);
          if (source !== visit.digest || seen.has(destination) || !this.frames.has(destination)) continue;
          seen.add(destination); queue.push({ digest: destination, path: [...visit.path, { edge, reverse }] });
        }
      }
      if (!selected || selected.length > BEFORE_ADMISSION_MAX_STEPS) throw new TypeError("BEFORE_ADMISSION_HISTORY_OWNER_REQUIRED");
      for (const hop of selected) this.steps.push({ sourceDigest: semanticStateDigest(hop.reverse ? hop.edge.after : hop.edge.before),
        operation: hop.reverse ? this.inverse(hop.edge) : structuredClone(hop.edge.operation) });
    } catch (error) { this.blocked = error instanceof TypeError ? error.message : "BEFORE_ADMISSION_HISTORY_INVALID"; }
    this.remember();
  }
  envelope(state: PlanSemanticStateV1): BeforeDraftAdmission | undefined {
    if (semanticStateDigest(state) !== semanticStateDigest(this.current)) throw new TypeError("BEFORE_ADMISSION_HISTORY_CHANGED");
    if (this.blocked === "BEFORE_ADMISSION_HISTORY_UNKNOWN_BASE") throw new TypeError(this.blocked);
    if (!this.required(state)) return undefined;
    if (this.blocked) throw new TypeError(this.blocked);
    if (!this.parentId) throw new TypeError("BEFORE_ADMISSION_PARENT_UNKNOWN");
    return parseBeforeDraftAdmission({ version: BEFORE_ADMISSION_VERSION, parentContextOccurrenceId: this.parentId, baseDigest: semanticStateDigest(this.baseState), steps: structuredClone(this.steps) });
  }
  acknowledge(saved: StoredComposerDraft, command: ComposerDraftSaveCommand) {
    if (command.expectedDraftId !== (this.durable?.draftId ?? null) || command.expectedDraftVersion !== (this.durable?.version ?? 0)) throw new TypeError("BEFORE_ADMISSION_ACK_BASE_CHANGED");
    if (saved.digest !== command.digest || plannerDigest(saved.semanticState) !== plannerDigest(command.semanticState)
      || saved.lastMutationRequestId !== command.requestId || saved.lastMutationExpectedVersion !== command.expectedDraftVersion) throw new TypeError("BEFORE_ADMISSION_ACK_INVALID");
    const selected = this.current, sent = command.beforeAdmission;
    const prefix = sent && plannerDigest(this.steps.slice(0, sent.steps.length)) === plannerDigest(sent.steps);
    this.durable = saved; this.baseState = saved.semanticState;
    if (semanticStateDigest(selected) === saved.digest) { this.steps = []; this.blocked = null; this.remember(); return; }
    if (prefix && this.steps[sent.steps.length]?.sourceDigest === saved.digest) { this.steps = this.steps.slice(sent.steps.length); this.remember(); return; }
    this.rebuild(selected);
    if (this.blocked) throw new TypeError("ACK_SELECTED_FRAME_REQUIRES_RECONCILIATION");
  }
}
