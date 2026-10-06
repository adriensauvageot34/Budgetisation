import React from "react";
import { createRoot } from "react-dom/client";
import { ComposerShell } from "../../src/app/mois-a-venir/composer/composer-shell";
import { AppShell } from "../../src/components/layout/app-shell";
import type { ComposerRequest } from "../../src/domain/phase2/planner/composer-ui-contract";

/** Isolated synthetic host; actual production Composer, no production auth bypass. */
async function transport(request: ComposerRequest) {
  const response = await fetch(`/interaction${location.search}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error("FIXTURE_TRANSPORT_FAILED");
  return response.json();
}
const initial = await transport({ kind: "READ", sequence: 0, targetMonth: "2026-11" });
if (!initial.ok) throw new Error(initial.code);
// Component contract only: C7 does not yet publish COMPLETE. No Apply may use
// this DTO; ordinary scenarios always use the unmodified compiler response.
const readyContract = new URLSearchParams(location.search).get("uiContract") === "ready";
const model = readyContract ? { ...initial.model, board: { ...initial.model.board,
  cockpit: { ...initial.model.board.cockpit, projectionCompleteness: "COMPLETE", applyReadiness: "READY" } } } : initial.model;
const fixtureTransport = readyContract ? async (request: ComposerRequest) => ({ ok: false, sequence: request.sequence,
  code: "UI_CONTRACT_ONLY", message: "Fixture de présentation uniquement : aucune application autorisée." }) : transport;
createRoot(document.getElementById("root")!).render(<AppShell><div data-ui-contract={readyContract ? "ready-presentation-only" : undefined} style={{height:"100%"}}><ComposerShell initialModel={model} transport={fixtureTransport} /></div></AppShell>);
