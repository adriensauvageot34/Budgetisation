import React from "react";
import { installL2aFixtureMetrics } from "./l2a-browser-metrics";
import { createRoot } from "react-dom/client";
import { ComposerShell } from "../../src/app/mois-a-venir/composer/composer-shell";
import { AppShell } from "../../src/components/layout/app-shell";
import type { ComposerRequest } from "../../src/domain/phase2/planner/composer-ui-contract";
import type { ComposerDraftLifecycleCommand, ComposerDraftResult, ComposerDraftSaveCommand, ComposerDraftSnapshot } from "../../src/domain/phase2/planner/composer-draft-contract";

/** Isolated synthetic host; actual production Composer, no production auth bypass. */
if (new URLSearchParams(location.search).get("l2aMetrics") === "1") installL2aFixtureMetrics();
async function transport(request: ComposerRequest) {
  const response = await fetch(`/interaction${location.search}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error("FIXTURE_TRANSPORT_FAILED");
  return response.json();
}
const durableFixture = new URLSearchParams(location.search).get("durable") === "1";
const measuring = new URLSearchParams(location.search).get("metrics") === "1";
if (measuring) {
  let editorClick: number | null = null;
  document.addEventListener("click", event => {
    const button = (event.target as Element | null)?.closest("button");
    if (button && (/Restaurant/u.test(button.textContent ?? "") || /Restaurant/u.test(button.getAttribute("aria-label") ?? ""))) editorClick = performance.now();
  }, true);
  new MutationObserver(() => {
    const panel = document.querySelector("[data-restaurant-editor],[data-catalog-context-editor]");
    if (!panel || editorClick === null) return;
    const start = editorClick; editorClick = null;
    requestAnimationFrame(() => requestAnimationFrame(() => panel.setAttribute("data-l1-editor-ms", String(performance.now() - start))));
  }).observe(document.getElementById("root")!, { childList: true, subtree: true });
}
const draftUrl = `/draft${location.search}`;
const draftRead = async (): Promise<ComposerDraftSnapshot> => {
  const response = await fetch(draftUrl);
  if (!response.ok) throw new Error("FIXTURE_DRAFT_READ_FAILED");
  return response.json();
};
const draftCall = async (kind: string, command: ComposerDraftSaveCommand | ComposerDraftLifecycleCommand): Promise<ComposerDraftResult> => {
  const response = await fetch(draftUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, command }) });
  if (response.ok) return response.json();
  // A response may be lost after the fixture committed. Inspect the request ID before retrying.
  const latest = await draftRead();
  const row = [latest.active, ...latest.archives].find(item => item?.lastMutationRequestId === command.requestId);
  if (row) return { ok: true, draft: row, replayed: true };
  return { ok: false, code: "UNAVAILABLE", message: "Réponse non confirmée.", latest };
};
const draftTransport = durableFixture ? {
  read: (_month: string) => draftRead(),
  save: (command: ComposerDraftSaveCommand) => draftCall("SAVE", command),
  archive: (command: ComposerDraftLifecycleCommand) => draftCall("ARCHIVE", command),
  restore: (command: ComposerDraftLifecycleCommand) => draftCall("RESTORE", command),
} : null;
const initialDrafts = durableFixture ? await draftRead() : null;
const initial = await transport({ kind: "READ", sequence: 0, targetMonth: "2026-11",
  ...(initialDrafts?.active ? { draft: initialDrafts.active.semanticState } : {}) });
if (!initial.ok) throw new Error(initial.code);
// Component contract only: C7 does not yet publish COMPLETE. No Apply may use
// this DTO; ordinary scenarios always use the unmodified compiler response.
const readyContract = new URLSearchParams(location.search).get("uiContract") === "ready";
const model = readyContract ? { ...initial.model, board: { ...initial.model.board,
  cockpit: { ...initial.model.board.cockpit, projectionCompleteness: "COMPLETE", applyReadiness: "READY" } } } : initial.model;
const fixtureTransport = readyContract ? async (request: ComposerRequest) => ({ ok: false, sequence: request.sequence,
  code: "UI_CONTRACT_ONLY", message: "Fixture de présentation uniquement : aucune application autorisée." }) : transport;
createRoot(document.getElementById("root")!).render(<AppShell><div data-ui-contract={readyContract ? "ready-presentation-only" : undefined} style={{height:"100%"}}><ComposerShell initialModel={model} transport={fixtureTransport} initialDrafts={initialDrafts} draftTransport={draftTransport} snapshotMetrics={measuring} /></div></AppShell>);
