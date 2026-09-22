import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/u, (value) => value.slice(1))), "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? pathToFileURL(path.join(root, "src", specifier.slice(2))).href : specifier;
    try { return nextResolve(target, context); } catch (error) {
      if ((!target.startsWith(".") && !target.startsWith("file:")) || /\.[cm]?[jt]sx?$/u.test(target)) throw error;
      for (const candidate of [`${target}.ts`, `${target}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw error;
    }
  },
});

const resolver = await import("../src/features/global-v2/persona/persona-detail-resolver.ts");
const runtimeModule = await import("../src/features/global-v2/visit-runtime.ts");
let checks = 0;
const check = (assertion) => { assertion(); checks += 1; };
const checkAsync = async (assertion) => { await assertion(); checks += 1; };

const publicationMeta = {
  publicationId: "00000000-0000-0000-0000-000000000101",
  revision: 101,
  factsHash: "facts",
  manifestHash: "manifest",
  generatedAt: "2026-09-22T00:00:00.000Z",
  profileId: "production",
};

const people = ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"];
const initialRequests = people.map(resolver.personaDetailIndexRequest);
check(() => assert.equal(initialRequests.length, 2));
check(() => assert.equal(initialRequests.every(({ resource }) => resource === "analysis_global_persona_detail"), true));
check(() => assert.equal(initialRequests.some(({ resource }) => resource === "analysis_global_place_mobility_detail"), false));
check(() => assert.deepEqual(initialRequests.map(({ params }) => params), people.map((personId) => ({ entityRef: `person:${personId}` }))));

const workRef = { resource: "analysis_global_place_mobility_detail", entityRef: "personal-mobility:work", role: "PRIMARY" };
const needRef = { resource: "analysis_global_category_need_detail", entityRef: "need:beauty", role: "PRIMARY" };
check(() => assert.deepEqual(resolver.personaOwnerDetailRequest(workRef), { resource: workRef.resource, params: { entityRef: workRef.entityRef } }));
check(() => assert.deepEqual(resolver.personaOwnerDetailRequest(needRef), { resource: needRef.resource, params: { entityRef: needRef.entityRef } }));
check(() => assert.equal(resolver.preferredPersonaDetailRef([{ ...workRef, role: "HISTORY" }, { ...needRef, role: "CONTEXT" }, needRef]), needRef));

const calls = [];
const runtime = new runtimeModule.GlobalV2VisitRuntime(publicationMeta, async (request) => {
  calls.push(request);
  return { data: { request }, publicationMeta };
});
await checkAsync(async () => {
  await runtime.request(resolver.personaOwnerDetailRequest(workRef), "DIRECT");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].resource, workRef.resource);
});
await checkAsync(async () => {
  await runtime.request(resolver.personaOwnerDetailRequest(workRef), "DIRECT");
  assert.equal(calls.length, 1);
});
await checkAsync(async () => {
  await runtime.request(resolver.personaOwnerDetailRequest(needRef), "DIRECT");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].resource, needRef.resource);
});
check(() => assert.equal(calls.some(({ resource }) => /leg/iu.test(resource)), false));

const ownerPresentation = resolver.presentPersonaOwnerDetail({
  metrics: [
    { metricId: "estimated-fuel-cost", labelKey: "Coût carburant d’usage estimé", displayValue: "260,34 €" },
    { metricId: "hidden", labelKey: "Method version", displayValue: "v4" },
  ],
  rows: [
    { rowId: "context", labelKey: "Contexte", displayValue: "Mobilité liée au travail" },
    { rowId: "empty", labelKey: "Dernière observation", displayValue: "—" },
  ],
  series: [],
});
check(() => assert.deepEqual(ownerPresentation.metrics.map(({ metricId }) => metricId), ["estimated-fuel-cost"]));
check(() => assert.deepEqual(ownerPresentation.rows.map(({ rowId }) => rowId), ["context"]));
check(() => assert.equal(ownerPresentation.empty, false));
check(() => assert.equal(resolver.personaDetailMetricLabel(ownerPresentation.metrics[0]), "Coût estimé du carburant utilisé"));
check(() => assert.equal(resolver.presentPersonaOwnerDetail({ metrics: [], rows: [], series: [] }).empty, true));

const viewSource = fs.readFileSync(path.join(root, "src/features/global-v2/persona/persona-view.tsx"), "utf8");
const resolverSource = fs.readFileSync(path.join(root, "src/features/global-v2/persona/persona-detail-resolver.ts"), "utf8");
check(() => assert.doesNotMatch(viewSource, /PersonaDetailDrawer|openDetail|onDetail|Voir le détail|useGlobalV2Resource/u));
check(() => assert.equal(fs.existsSync(path.join(root, "src/features/global-v2/persona/persona-detail-drawer.tsx")), false));
check(() => assert.doesNotMatch(resolverSource, /@supabase|createClient|service_role|MobilityLeg/u));
check(() => assert.doesNotMatch(resolverSource, /Adrien|Manon|if\s*\([^)]*beauty/iu));

console.log(`Global V2 Persona detail removal and generic resolver: ${checks}/${checks} PASS`);
console.log("Persona drawer requests: 0; generic visit cache reuse: PASS; raw MobilityLeg requests: 0.");
