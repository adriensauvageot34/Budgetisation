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
createRoot(document.getElementById("root")!).render(<AppShell><ComposerShell initialModel={initial.model} transport={transport} /></AppShell>);
