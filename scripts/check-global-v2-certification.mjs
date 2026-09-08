import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = process.cwd();
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier.startsWith("@/")) specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
  try { return next(specifier, context); } catch (error) {
    if ((!specifier.startsWith(".") && !specifier.startsWith("file:")) || /\.[cm]?[jt]s$/u.test(specifier)) throw error;
    for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) try { return next(candidate, context); } catch { /* next */ }
    throw error;
  }
} });

const core = await import("../src/core/global-v2/index.ts");
const query = await import("../src/query-api/global-v2/index.ts");
const planApi = await import("../src/server/analytics/materialization/global-query-plan.ts");
const materialization = await import("../src/server/analytics/materialization/global-v2.ts");
const analytics = await import("../src/analytics/global-v2/index.ts");
const relationshipCatalog = await import("../src/analytics/global-v2/relationship-catalog.ts");
const relationshipWeekly = await import("../src/analytics/global-v2/relationship-weekly.ts");
const { buildIntegratedGlobalV2Candidate } = await import("./lib/global-v2-integrated-candidate.mjs");

let checks = 0;
const check = (fn) => { fn(); checks += 1; };
const candidate = await buildIntegratedGlobalV2Candidate({ core, query, planApi, materialization, analytics });
const replay = await buildIntegratedGlobalV2Candidate({ core, query, planApi, materialization, analytics });

check(() => assert.equal(candidate.outputs.length, 10));
check(() => assert.equal(candidate.plan.instances.length, 33));
check(() => assert.equal(candidate.plan.instances.every(({ resource, payload }) => query.globalV2QueryRegistry[resource].schema.safeParse(payload).success), true));
check(() => assert.equal(candidate.plan.closures.length, 33));
check(() => assert.equal(candidate.manifest.closures.length, 34));
check(() => assert.equal(candidate.manifest.requiredQueryKeys.length, 33));
check(() => assert.equal(candidate.manifest.requiredArtifactKeys.length, 1));
check(() => assert.equal(candidate.manifest.manifestHash, replay.manifest.manifestHash));
check(() => assert.equal(candidate.manifest.publicationFactsHash, replay.manifest.publicationFactsHash));
check(() => assert.deepEqual(candidate.plan.requiredQueryKeys, replay.plan.requiredQueryKeys));
check(() => assert.equal(new Set(candidate.outputs.map(({ digest }) => digest)).size, 10));
check(() => assert.equal(candidate.plan.instances.every(({ dependencies }) => dependencies.every(({ authority }) => authority === "METRIC")), true));

const mutated = await buildIntegratedGlobalV2Candidate({ core, query, planApi, materialization, analytics });
mutated.inputs[0].dependencies[0].digest = "f".repeat(64);
check(() => assert.throws(() => planApi.buildGlobalV2QueryPlan({ instances: mutated.inputs }), /RESOURCE_META_MISMATCH/));

const nextInputs = candidate.inputs.filter(({ resource }) => resource !== "analysis_global_methodology");
const nextPlan = planApi.buildGlobalV2QueryPlan({ instances: nextInputs });
check(() => assert.throws(() => planApi.assertGlobalV2NoResidualKeys(nextPlan, candidate.plan.requiredQueryKeys), /RESIDUAL_OR_MISSING/));
check(() => assert.doesNotThrow(() => planApi.assertGlobalV2NoResidualKeys(nextPlan, nextPlan.requiredQueryKeys)));

const dependencyFamilies = new Set(candidate.manifest.closures.flatMap(({ dependencies }) => dependencies.map(({ family }) => family)));
for (const output of candidate.outputs) check(() => assert.equal(dependencyFamilies.has(`global_${output.moduleKey.toLowerCase()}_qualified_output`), true));

const fdrDefinitions = [
  ...relationshipCatalog.dailyRelationshipCatalog,
  ...relationshipWeekly.weeklyRelationshipCatalog,
  ...relationshipCatalog.nonDailyRelationshipPlan,
].map(({ id }) => id).sort();
check(() => assert.equal(fdrDefinitions.length, 31));
check(() => assert.equal(new Set(fdrDefinitions).size, 31));
const fdrDigestBefore = materialization.globalV2ClosureInputDigest(fdrDefinitions.map((id) => ({ authority: "METRIC", family: "global_m5_fdr_definition", identity: id, digest: materialization.globalV2ClosureInputDigest([{ authority: "METRIC", family: "global_m5_definition", identity: id, digest: "1".repeat(64), required: true }]), required: true })));
const fdrDigestAfter = materialization.globalV2ClosureInputDigest([...fdrDefinitions].reverse().map((id) => ({ authority: "METRIC", family: "global_m5_fdr_definition", identity: id, digest: materialization.globalV2ClosureInputDigest([{ authority: "METRIC", family: "global_m5_definition", identity: id, digest: "1".repeat(64), required: true }]), required: true })));
check(() => assert.equal(fdrDigestBefore, fdrDigestAfter));

console.log(`Global V2 integrated certification: ${checks}/${checks} PASS`);
console.log(`C-A→C-E: outputs=${candidate.outputs.length}; queries=${candidate.plan.instances.length}; artifacts=1; closures=${candidate.manifest.closures.length}`);
console.log(`publicationFactsHash=${candidate.manifest.publicationFactsHash}; manifestHash=${candidate.manifest.manifestHash}`);
console.log("R11_FDR_CLOSURE=PASS; R12_SHARED_CANDIDATE=PASS; LIVE_WRITES=NONE");
