import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "../../src/components/layout/app-shell";
import { ComposerShell } from "../../src/app/mois-a-venir/composer/composer-shell";
import type { ComposerResponse, ComposerRequest, ComposerUiModel } from "../../src/domain/phase2/planner/composer-ui-contract";

/** This host has no Draft transport, SQL or authenticated client. */
const response = await fetch(`/model${location.search}`);
if (!response.ok) throw Error("B1_FIXTURE_READ_FAILED");
const model = await response.json() as ComposerUiModel;
const transport = async (request: ComposerRequest): Promise<ComposerResponse> => {
  const response = await fetch("/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
  return response.json();
};
createRoot(document.getElementById("root")!).render(<AppShell><ComposerShell initialModel={model} transport={transport} /></AppShell>);
