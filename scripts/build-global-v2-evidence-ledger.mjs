import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexPath = path.join(root, "docs/global-v2/GLOBAL_MASTER_INDEX.json");
const outputPath = path.join(root, "docs/global-v2/execution/P17-evidence-ledger.json");
const master = JSON.parse(fs.readFileSync(indexPath, "utf8"));

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const unique = (values, label) => assert.equal(new Set(values).size, values.length, `${label}_DUPLICATE`);

unique(master.requirements.map(({ id }) => id), "REQUIREMENT_ID");
unique(master.tests.map(({ id }) => id), "TEST_ID");
unique(master.capabilities.map(({ id }) => id), "CAT_CAP_ID");

const requirementsById = new Map(master.requirements.map((item) => [item.id, item]));
const testsByRequirement = new Map();
for (const test of master.tests) {
  assert.ok(test.source?.document && test.source?.anchor, `TEST_SOURCE_MISSING:${test.id}`);
  assert.ok(test.owner, `TEST_OWNER_MISSING:${test.id}`);
  for (const requirementId of test.sourceRequirementIds) {
    assert.ok(requirementsById.has(requirementId), `TEST_REQUIREMENT_UNKNOWN:${test.id}:${requirementId}`);
    const values = testsByRequirement.get(requirementId) ?? [];
    values.push(test.id);
    testsByRequirement.set(requirementId, values);
  }
}

const requirementEvidence = master.requirements.map((requirement) => {
  assert.ok(requirement.source?.document && requirement.source?.section && requirement.source?.anchor, `REQUIREMENT_SOURCE_MISSING:${requirement.id}`);
  assert.ok(requirement.owner && requirement.capabilityId, `REQUIREMENT_BINDING_MISSING:${requirement.id}`);
  const testIds = [...(testsByRequirement.get(requirement.id) ?? [])].sort();
  const result = {
    namespace: "REQ",
    id: requirement.id,
    semanticCapability: { namespace: "SEM_CAP", id: requirement.capabilityId },
    source: requirement.source,
    owner: requirement.owner,
    scopeV1: requirement.scopeV1,
    conditionalMode: requirement.conditionalMode,
    certificationSeverity: requirement.certificationSeverity,
    conceptualTestIds: testIds,
    futureCaseIds: testIds.map((testId) => `GC1/${requirement.owner}/TEST/${testId}`),
    traceabilityState: testIds.length > 0 ? "SOURCE_LINKED" : "NO_CONCEPTUAL_TEST_BY_SOURCE",
    executionState: "NOT_RUN_P17_LEDGER",
  };
  return { ...result, evidenceDigest: digest(result) };
});

const conceptualTestEvidence = master.tests.map((test) => {
  const result = {
    namespace: "TEST",
    id: test.id,
    semanticCapability: { namespace: "SEM_CAP", id: test.capabilityId },
    sourceRequirementIds: [...test.sourceRequirementIds].sort(),
    source: test.source,
    owner: test.owner,
    testFamily: test.testFamily,
    severity: test.severity,
    caseId: `GC1/${test.owner}/TEST/${test.id}`,
    assertionSlot: "MASTER_CONCEPTUAL_ASSERTION",
    command: "P17B_GC1_EXECUTABLE_LEDGER",
    expected: "ASSERTION_DEFINED_BY_MASTER_SOURCE",
    result: "NOT_RUN_P17_LEDGER",
    reuseClassification: "REPLAY_REQUIRED",
  };
  return { ...result, evidenceDigest: digest(result) };
});

const catCapabilityEvidence = master.capabilities.map((capability) => {
  assert.ok(capability.source?.document && Number.isInteger(capability.source?.tableIndex), `CAT_CAP_SOURCE_MISSING:${capability.id}`);
  assert.ok(capability.owner, `CAT_CAP_OWNER_MISSING:${capability.id}`);
  const slots = ["PREREQUISITE", "AVAILABILITY", "PUBLICATION", "FORBIDDEN"].map((kind) => ({
    kind,
    caseId: `GC1/${capability.owner}/CAT_CAP/${capability.id}/${kind}`,
    result: "NOT_RUN_P17_LEDGER",
  }));
  const result = {
    namespace: "CAT_CAP",
    id: capability.id,
    source: capability.source,
    owner: capability.owner,
    scopeV1: capability.scopeV1,
    conditionalMode: capability.conditionalMode,
    implementationRequiredInV1: capability.implementationRequiredInV1,
    testsRequiredInV1: capability.testsRequiredInV1,
    crosswalkToRequirements: "NO_EXPLICIT_CROSSWALK_BY_SOURCE",
    assertionSlots: slots,
    executionState: "NOT_RUN_P17_LEDGER",
  };
  return { ...result, evidenceDigest: digest(result) };
});

const body = {
  formatVersion: "global-v2-evidence-ledger@v1",
  authority: {
    sourceIndex: "docs/global-v2/GLOBAL_MASTER_INDEX.json",
    sourceIndexDigest: digest(master),
    rule: "REQ/SEM_CAP/TEST and CAT_CAP remain separate unless the Master provides an explicit edge.",
  },
  counts: {
    requirements: requirementEvidence.length,
    conceptualTests: conceptualTestEvidence.length,
    catalogueCapabilities: catCapabilityEvidence.length,
    explicitRequirementTestEdges: conceptualTestEvidence.reduce((sum, item) => sum + item.sourceRequirementIds.length, 0),
    inventedCrosswalkEdges: 0,
  },
  requirementEvidence,
  conceptualTestEvidence,
  catCapabilityEvidence,
};
const ledger = { ...body, ledgerDigest: digest(body) };
fs.writeFileSync(outputPath, `${JSON.stringify(ledger, null, 2)}\n`);

const reread = JSON.parse(fs.readFileSync(outputPath, "utf8"));
assert.equal(reread.ledgerDigest, digest(Object.fromEntries(Object.entries(reread).filter(([key]) => key !== "ledgerDigest"))), "LEDGER_DIGEST_MISMATCH");
assert.equal(reread.counts.requirements, master.counts.requirements);
assert.equal(reread.counts.conceptualTests, master.counts.tests);
assert.equal(reread.counts.catalogueCapabilities, master.counts.capabilities);
assert.equal(reread.counts.inventedCrosswalkEdges, 0);
console.log(`Global V2 evidence ledger: ${reread.counts.requirements} requirements, ${reread.counts.conceptualTests} tests, ${reread.counts.catalogueCapabilities} CAT_CAP; digest=${reread.ledgerDigest}`);
