"use client";
import { ROOT_RELATION_DRAFT_HTTP_CONTRACT } from "@/domain/phase2/planner/root-relation-draft-contract";
import { parseCompatibleRootRelationDraft, rootRelationDraftBase } from "@/domain/phase2/planner/root-relation-draft-codec";
import type { RootRelationDurableTransport } from "@/domain/phase2/planner/root-relation-durable-contract";
import { plannerKeys, plannerMonth, plannerRecord } from "@/domain/phase2/planner/json";

const path = "/api/composer/root-relation-drafts";
const headers = { "X-Composer-Draft-Contract": ROOT_RELATION_DRAFT_HTTP_CONTRACT };
async function response(request: Promise<Response>) {
  const result = await request;
  if (result.headers.get("X-Composer-Draft-Contract") !== ROOT_RELATION_DRAFT_HTTP_CONTRACT)
    throw new TypeError("N1_DRAFT_TRANSPORT_UNSUPPORTED");
  const value = plannerRecord(await result.json());
  if (!result.ok) throw new TypeError(typeof value.code === "string" && /^(N1_|PLANNER_|AUTHENTICATION_)[A-Z0-9_]+$/u.test(value.code)
    ? value.code : "N1_DURABLE_UNAVAILABLE");
  if (value.contract !== ROOT_RELATION_DRAFT_HTTP_CONTRACT) throw new TypeError("N1_DRAFT_TRANSPORT_UNSUPPORTED");
  return value;
}
/** Complete versioned documents only. This transport never sets a Composer SAVED status. */
export const rootRelationDurableTransport: RootRelationDurableTransport = {
  async read(month) {
    plannerMonth(month);
    const value = await response(fetch(`${path}?month=${encodeURIComponent(month)}`, { credentials: "same-origin", cache: "no-store", headers }));
    plannerKeys(value, ["contract", "kind", "snapshot"]);
    if (value.kind !== "SNAPSHOT") throw new TypeError("N1_DRAFT_TRANSPORT_UNSUPPORTED");
    const snapshot = plannerRecord(value.snapshot);
    plannerKeys(snapshot, ["active", "archives", "activePlanRevisionId", "activePlanRevisionNumber", "baseStale"]);
    if (!Array.isArray(snapshot.archives) || typeof snapshot.baseStale !== "boolean") throw new TypeError("N1_DRAFT_METADATA_INVALID");
    const active = snapshot.active === null ? null : parseCompatibleRootRelationDraft(snapshot.active);
    const archives = snapshot.archives.map(parseCompatibleRootRelationDraft);
    const rows = [...(active ? [active] : []), ...archives];
    if (active?.lifecycle === "ABANDONED" || archives.some(row => row.lifecycle !== "ABANDONED")
      || rows.some(row => row.semanticState.targetMonth !== month) || new Set(rows.map(row => row.draftId)).size !== rows.length)
      throw new TypeError("N1_DRAFT_SCOPE_MISMATCH");
    const base = rootRelationDraftBase(snapshot.activePlanRevisionId, snapshot.activePlanRevisionNumber);
    const stale = !!active && (active.baseRevisionId !== base.revisionId || active.baseRevisionNumber !== base.revisionNumber);
    if (stale !== snapshot.baseStale) throw new TypeError("N1_DRAFT_METADATA_INVALID");
    return { active, archives, activePlanRevisionId: base.revisionId, activePlanRevisionNumber: base.revisionNumber, baseStale: stale };
  },
  async save(packet) {
    const value = await response(fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(packet) }));
    plannerKeys(value, ["contract", "kind", "draft", "replayed"]);
    if (value.kind !== "SAVE_RECEIPT" || typeof value.replayed !== "boolean") throw new TypeError("N1_DRAFT_RECEIPT_INVALID");
    return { contract: ROOT_RELATION_DRAFT_HTTP_CONTRACT, kind: "SAVE_RECEIPT", draft: parseCompatibleRootRelationDraft(value.draft), replayed: value.replayed };
  },
};
