import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "../../src/components/layout/app-shell";
import { ComposerShell } from "../../src/app/mois-a-venir/composer/composer-shell";
import { rootRelationDurableTransport } from "../../src/app/mois-a-venir/composer/root-relation-durable-transport";
import { rootRelationFinancialReadSnapshot } from "../../src/domain/phase2/planner/root-relation-durable-contract";
import type { ComposerRequest } from "../../src/domain/phase2/planner/composer-ui-contract";
const transport = async (request: ComposerRequest) => {
  const response = await fetch("/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
  if (!response.ok) throw new Error("RECIPE_COMPOSER_REQUEST_REFUSED");
  return response.json();
};
// Every actual document reload starts at the real HTTP reader/DB, never a manufactured cache.
const rootDrafts = await rootRelationDurableTransport.read("2026-11");
const drafts = rootRelationFinancialReadSnapshot(rootDrafts);
const opening = await transport({ kind: "READ", sequence: 0, targetMonth: "2026-11", draft: drafts.active!.semanticState });
if (!opening.ok) throw new Error(opening.code);
createRoot(document.getElementById("root")!).render(<AppShell><ComposerShell initialModel={opening.model} transport={transport}
  initialDrafts={drafts} initialRootDrafts={rootDrafts} durableDraftHttp
  rootRelationAccess={{ scopeKey: "native-n1-recipe:2026-11", enabled: true, durable: true }} /></AppShell>);
