import assert from "node:assert/strict";
import Module from "node:module";
import { require } from "./lib/phase2-ts-loader.mjs";

const entries = new Map();
const originalLoad = Module._load;
Module._load = function load(name, ...args) {
  if (name !== "next/cache") return originalLoad.call(this, name, ...args);
  return { unstable_cache: (build, keys) => async () => {
    const key = JSON.stringify(keys);
    if (entries.has(key)) return JSON.parse(entries.get(key));
    const value = await build();
    entries.set(key, JSON.stringify(value));
    return value;
  } };
};
const { createMonthSourceCache } = require("@/server/phase2/month-source-cache");
Module._load = originalLoad;

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const household = { householdId: uuid(1), timezone: "Europe/Paris" };
const bootstrap = {
  user: { id: uuid(3) }, household, persons: [], periods: [],
  revision: { dataRevision: "8", analyticsRevision: "4" },
};
let currentRevision = "10", allowed = household.householdId, covered = true;
let authorizedReads = 0, originReads = 0;
const client = { async rpc(name, { p_scope, p_key }) {
  assert.equal(name, "inspect_composer_historical_basis_v1");
  assert.equal(p_scope.cutoffDate, p_scope.endExclusive);
  assert.match(p_key, /^[a-f0-9]{64}$/u);
  authorizedReads++;
  if (p_scope.householdId !== allowed) return { error: { code: "42501" }, data: null };
  return { error: null, data: { generation: 0, artifact: null, proof: covered
    ? { coverage: "composer-historical-writers@v2", revision: currentRevision, schemaEpoch: "2" } : null } };
} };
const origin = async () => ({ sequence: ++originReads });
const read = (month = "2026-06", context = bootstrap) => createMonthSourceCache(client, context, month).read("test", origin);

assert.deepEqual(await read(), { sequence: 1 });
assert.deepEqual(await read(), { sequence: 1 });
assert.equal(authorizedReads, 3, "A hit must still check access and a miss checks again before caching");
assert.deepEqual(await read("2026-05"), { sequence: 2 });

const other = { ...bootstrap, household: { ...household, householdId: uuid(2) } };
await assert.rejects(read("2026-06", other), error => error.code === "42501");
assert.equal(originReads, 2);
allowed = other.household.householdId;
assert.deepEqual(await read("2026-06", other), { sequence: 3 }, "A second household has its own cache entry");
await assert.rejects(read(), error => error.code === "42501", "A revoked session cannot read a warm entry");
allowed = household.householdId;

currentRevision = "11";
assert.deepEqual(await read(), { sequence: 4 }, "Canonical corrections or imports invalidate the version");
const published = { ...bootstrap, revision: { ...bootstrap.revision, analyticsRevision: "5" } };
assert.deepEqual(await read("2026-06", published), { sequence: 5 }, "A publication uses a new version");

const racing = createMonthSourceCache(client, bootstrap, "2026-04");
const before = entries.size;
await racing.read("test", async () => {
  currentRevision = "12";
  return origin();
});
assert.equal(entries.size, before, "A write racing a source read may not populate the old entry");
assert.deepEqual(await read("2026-04"), { sequence: 7 });

covered = false;
assert.deepEqual(await read("2026-04"), { sequence: 8 }, "Missing coverage reads the live source");
assert.deepEqual(await read("2026-04"), { sequence: 9 });
assert.equal(entries.size, before + 1);
console.log("PASS: monthly cache hits, source revisions, publications, authorization, household isolation and concurrent writes");
