import fs from "node:fs";
import Module, { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const require = createRequire(import.meta.url);
const repositoryRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function loadServerModule(request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
Module._resolveFilename = function resolveServerModule(request, parent, isMain, options) {
  const resolvedRequest = request.startsWith("@/")
    ? path.join(repositoryRoot, "src", request.slice(2))
    : request;
  try {
    return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
  } catch (originalError) {
    if (path.extname(resolvedRequest) !== "") throw originalError;
    for (const candidate of [
      `${resolvedRequest}.ts`, `${resolvedRequest}.tsx`,
      path.join(resolvedRequest, "index.ts"), path.join(resolvedRequest, "index.tsx"),
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
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
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

const householdId = process.env.ANALYTICS_BACKFILL_HOUSEHOLD_ID;
if (!householdId) {
  throw new Error("ANALYTICS_BACKFILL_HOUSEHOLD_ID est requis.");
}
const { createCanonicalReadClient } = require(path.join(
  repositoryRoot,
  "src/server/canonical/client.ts",
));
const {
  backfillAnalyticsMaterialization,
  DEFAULT_ANALYTICS_BACKFILL_MONTHS,
} = require(path.join(
  repositoryRoot,
  "src/server/analytics/materialization/backfill.ts",
));

await backfillAnalyticsMaterialization({
  client: createCanonicalReadClient(),
  householdId,
  months: DEFAULT_ANALYTICS_BACKFILL_MONTHS,
  force: process.env.ANALYTICS_BACKFILL_FORCE === "true",
  onProgress: ({ month, status }) => console.info("analytics_backfill", { month, status }),
});
