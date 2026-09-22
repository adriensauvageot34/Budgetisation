import fs from "node:fs/promises";
import process from "node:process";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    try { return nextResolve(specifier, context); } catch (originalError) {
      if (!specifier.startsWith(".") || /\.[cm]?[jt]sx?$/.test(specifier)) throw originalError;
      for (const candidate of [`${specifier}.ts`, `${specifier}/index.ts`]) {
        try { return nextResolve(candidate, context); } catch { /* continue */ }
      }
      throw originalError;
    }
  },
});

const { buildCanonicalMobilityImportPlan } = await import("../src/server/canonical/mobility-import.ts");

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (process.argv.includes("--apply")) {
  throw new Error("P4_5_B_HUMAN_APPROVAL_REQUIRED: cet importeur est dry-run only dans P4.5-A.");
}
const filePath = argument("--file") ?? process.env.MOBILITY_SOURCE_XLSX;
const householdId = argument("--household-id") ?? process.env.MOBILITY_HOUSEHOLD_ID;
const vehicleId = argument("--vehicle-id") ?? process.env.MOBILITY_VEHICLE_ID;
if (!filePath) throw new Error("MOBILITY_SOURCE_XLSX ou --file est requis.");
if (!householdId) throw new Error("MOBILITY_HOUSEHOLD_ID ou --household-id est requis.");

const placeAuthorityPath = argument("--place-authority");
const existingPath = argument("--existing-identities");
const placeAuthorityStdin = process.argv.includes("--place-authority-stdin");
if (placeAuthorityPath !== undefined && placeAuthorityStdin) {
  throw new Error("Choisir --place-authority ou --place-authority-stdin, pas les deux.");
}
const stdinChunks = [];
if (placeAuthorityStdin) {
  for await (const chunk of process.stdin) stdinChunks.push(chunk);
}
const placeAuthorities = placeAuthorityStdin
  ? JSON.parse(Buffer.concat(stdinChunks).toString("utf8"))
  : placeAuthorityPath === undefined
    ? []
    : JSON.parse(await fs.readFile(placeAuthorityPath, "utf8"));
const existing = existingPath === undefined
  ? undefined
  : JSON.parse(await fs.readFile(existingPath, "utf8"));
const plan = await buildCanonicalMobilityImportPlan({
  filePath,
  householdId,
  ...(vehicleId === undefined ? {} : { vehicleId }),
  placeAuthorities,
  ...(existing === undefined ? {} : { existing }),
});

process.stdout.write(`${JSON.stringify(plan.report, null, 2)}\n`);
