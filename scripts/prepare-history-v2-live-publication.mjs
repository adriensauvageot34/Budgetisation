import assert from "node:assert/strict";
import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const require = createRequire(import.meta.url);
const repositoryRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function loadHistoryV2Module(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveHistoryV2Module(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(repositoryRoot, "src", request.slice(2))
    : request;
  try {
    return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
  } catch (originalError) {
    if (path.extname(resolvedRequest) !== "") throw originalError;
    for (const candidate of [
      `${resolvedRequest}.ts`,
      `${resolvedRequest}.tsx`,
      path.join(resolvedRequest, "index.ts"),
      path.join(resolvedRequest, "index.tsx"),
    ]) {
      try {
        return originalResolveFilename.call(this, candidate, parent, isMain, options);
      } catch {
        // Try the next TypeScript resolution convention.
      }
    }
    throw originalError;
  }
};
for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) => {
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: filename,
    }).outputText;
    module._compile(output, filename);
  };
}

const [bundleFile, draftPlanFile, outputDirectory] = process.argv.slice(2);
if (bundleFile === undefined || draftPlanFile === undefined || outputDirectory === undefined) {
  throw new Error("Usage: node scripts/prepare-history-v2-live-publication.mjs <preflight-bundle.json> <draft-plan.json> <output-directory>");
}

const materialization = require(path.join(repositoryRoot, "src/server/analytics/materialization/history-v2.ts"));
const identity = require(path.join(repositoryRoot, "src/server/analytics/materialization/identity.ts"));
const bundle = JSON.parse(fs.readFileSync(path.resolve(bundleFile), "utf8"));
const draftPlan = JSON.parse(fs.readFileSync(path.resolve(draftPlanFile), "utf8"));
const outputPath = path.resolve(outputDirectory);
fs.mkdirSync(outputPath, { recursive: true });

assert.equal(bundle.implementationSha, draftPlan.implementationSha);
assert.equal(bundle.deterministicDigest, draftPlan.deterministicDigest);
assert.equal(bundle.months.length, 12);
assert.equal(draftPlan.months.length, 12);

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const jsonSql = (value) => `${sqlString(JSON.stringify(value))}::jsonb`;
const subjectColumns = (subject) => subject.kind === "household"
  ? { subject_kind: "household", subject_id: null }
  : { subject_kind: "person", subject_id: subject.personId };
const periodColumns = (period) => period.kind === "month"
  ? { period_kind: "month", period_month: `${period.month}-01`, as_of_month: null }
  : { period_kind: "global", period_month: null, as_of_month: `${period.asOf}-01` };

function insertSql(table, rows, columns, conflict) {
  return [
    "begin;",
    `insert into public.${table} (${columns.join(",")})`,
    `select ${columns.map((column) => `x.${column}`).join(",")}`,
    `from jsonb_to_recordset(${jsonSql(rows)}) as x(${columns.map((column) => {
      const types = {
        artifact_key: "text", generation_key: "text", household_id: "uuid", subject_kind: "text", subject_id: "uuid",
        period_kind: "text", period_month: "date", as_of_month: "date", artifact_family: "text", metric_id: "text",
        dimension_key: "text", bucket_key: "text", scope_hash: "text", filter_signature: "text", method_version: "text",
        contract_version: "text", source_revision: "bigint", analytics_revision: "bigint", payload: "jsonb",
        computed_at: "timestamptz", publication_id: "uuid", is_active: "boolean", invalidated_at: "timestamptz",
        invalidation_revision: "bigint", query_key: "text", resource: "text", normalized_param_signature: "text",
        method_signature: "text", expires_at: "timestamptz",
      };
      return `${column} ${types[column]}`;
    }).join(",")})`,
    `on conflict (${conflict.join(",")}) do update set`,
    columns.filter((column) => !conflict.includes(column)).map((column) => `${column}=excluded.${column}`).join(","),
    ";",
    "commit;",
  ].join("\n");
}

const index = [];
for (const { month, preflight } of bundle.months) {
  const plan = draftPlan.months.find((candidate) => candidate.month === month);
  assert.ok(plan, `Plan DRAFT absent pour ${month}`);
  assert.deepEqual(preflight.manifest.requiredArtifactKeys, plan.requiredArtifactKeys);
  assert.deepEqual(preflight.manifest.requiredQueryKeys, plan.requiredQueryKeys);
  const stage = materialization.stageHistoryV2GenerationInMemory({
    preflight,
    publicationId: plan.publicationId,
    revision: Number(plan.publishedAnalyticsRevision),
    generatedAt: draftPlan.generatedAt,
  });

  const artifactRows = stage.artifacts.map((envelope) => {
    const itemIdentity = identity.historyV2SharedArtifactIdentity(
      bundle.context,
      month,
      envelope.artifactFamily,
      "current",
    );
    return {
      artifact_key: itemIdentity.artifactKey,
      generation_key: plan.publicationId,
      household_id: itemIdentity.householdId,
      ...subjectColumns(itemIdentity.subject),
      ...periodColumns(itemIdentity.period),
      artifact_family: itemIdentity.artifactFamily,
      metric_id: itemIdentity.metricId,
      dimension_key: null,
      bucket_key: null,
      scope_hash: itemIdentity.scopeHash,
      filter_signature: itemIdentity.filterSignature,
      method_version: itemIdentity.methodVersion,
      contract_version: itemIdentity.contractVersion,
      source_revision: itemIdentity.period.sourceRevision,
      analytics_revision: plan.baseAnalyticsRevision,
      payload: envelope,
      computed_at: draftPlan.generatedAt,
      publication_id: plan.publicationId,
      is_active: false,
      invalidated_at: null,
      invalidation_revision: null,
    };
  });
  const queryRows = stage.queries.map(({ request, data }) => {
    const itemIdentity = identity.querySnapshotIdentity(bundle.context, request, "current");
    return {
      query_key: itemIdentity.queryKey,
      generation_key: plan.publicationId,
      household_id: itemIdentity.householdId,
      resource: itemIdentity.resource,
      scope_hash: itemIdentity.scopeHash,
      normalized_param_signature: itemIdentity.normalizedParamSignature,
      ...subjectColumns(itemIdentity.subject),
      ...periodColumns(itemIdentity.period),
      source_revision: itemIdentity.period.sourceRevision,
      analytics_revision: plan.baseAnalyticsRevision,
      contract_version: itemIdentity.contractVersion,
      method_signature: itemIdentity.methodSignature,
      payload: data,
      computed_at: draftPlan.generatedAt,
      expires_at: null,
      publication_id: plan.publicationId,
      is_active: false,
      invalidated_at: null,
      invalidation_revision: null,
    };
  });

  assert.equal(artifactRows.length, 2);
  assert.equal(queryRows.length, preflight.manifest.requiredQueryKeys.length);
  assert.ok([...artifactRows, ...queryRows].every((row) => row.payload.publicationMeta.publicationId === plan.publicationId));
  assert.ok([...artifactRows, ...queryRows].every((row) => row.payload.publicationMeta.factsHash === preflight.manifest.publicationFactsHash));

  const artifactColumns = Object.keys(artifactRows[0]);
  const queryColumns = Object.keys(queryRows[0]);
  const files = [];
  const artifactFile = `${month}-artifacts.sql`;
  fs.writeFileSync(path.join(outputPath, artifactFile), insertSql(
    "analytics_artifacts",
    artifactRows,
    artifactColumns,
    ["artifact_key", "source_revision", "method_version", "contract_version", "generation_key"],
  ));
  files.push(artifactFile);
  for (let offset = 0; offset < queryRows.length; offset += 20) {
    const file = `${month}-queries-${String(offset / 20 + 1).padStart(2, "0")}.sql`;
    fs.writeFileSync(path.join(outputPath, file), insertSql(
      "analytics_query_snapshots",
      queryRows.slice(offset, offset + 20),
      queryColumns,
      ["query_key", "source_revision", "contract_version", "method_signature", "generation_key"],
    ));
    files.push(file);
  }
  index.push({
    month,
    publicationId: plan.publicationId,
    baseAnalyticsRevision: plan.baseAnalyticsRevision,
    publishedAnalyticsRevision: plan.publishedAnalyticsRevision,
    factsHash: preflight.manifest.publicationFactsHash,
    manifestHash: preflight.manifest.manifestHash,
    artifactCount: artifactRows.length,
    queryCount: queryRows.length,
    files,
  });
}

fs.writeFileSync(path.join(outputPath, "index.json"), `${JSON.stringify({
  implementationSha: bundle.implementationSha,
  deterministicDigest: bundle.deterministicDigest,
  generatedAt: draftPlan.generatedAt,
  months: index,
}, null, 2)}\n`);
console.log(JSON.stringify({
  months: index.length,
  artifacts: index.reduce((sum, value) => sum + value.artifactCount, 0),
  queries: index.reduce((sum, value) => sum + value.queryCount, 0),
  sqlFiles: index.reduce((sum, value) => sum + value.files.length, 0),
}, null, 2));
