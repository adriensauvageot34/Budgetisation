// Compare actual pre-C and current product code, with a private captured world.
// Unlike P1 counterfactuals, neither branch is rewritten to invent a predicate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { require } from './lib/phase2-ts-loader.mjs';
const [input, output, beforeRef] = process.argv.slice(2);
if (!input || !output || !beforeRef) throw new Error('PRIVATE_WORLD_OUTPUT_PRE_C_REF_REQUIRED');
const { world, state, base, expected } = JSON.parse(fs.readFileSync(input, 'utf8'));
globalThis.fetch = async () => { throw new Error('PAIRED_BENCHMARK_NETWORK_FORBIDDEN'); };
const cutoff = '2026-10-06T21:00:00Z', NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [cutoff])); }
  static now() { return NativeDate.parse(cutoff); }
};
const sourceFile = path.resolve('src/server/phase2/planner/preview.ts');
function load(code, name) {
  const filename = path.join(path.dirname(sourceFile), `${name}.js`), module = new Module(filename);
  module.filename = filename; module.paths = Module._nodeModulePaths(path.dirname(filename));
  module._compile(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return module.exports.evaluatePlanScenario;
}
const evaluators = {
  before: load(execFileSync('git', ['show', `${beforeRef}:src/server/phase2/planner/preview.ts`], { encoding: 'utf8', windowsHide: true }), 'p2a-before'),
  after: load(fs.readFileSync(sourceFile, 'utf8'), 'p2a-after'),
};
let counts;
for (const [name, owner, key] of [['compile', require('@/server/phase2/planner/compiler'), 'compileSemanticPlan'],
  ['derive', require('@/server/phase2/month-scenario'), 'deriveMonthScenario']]) {
  const original = owner[key];
  owner[key] = function (...args) { if (counts) counts[name] = (counts[name] ?? 0) + 1; return original.apply(this, args); };
}
const { plannerDigest } = require('@/domain/phase2/planner/json');
const businessDigest = value => plannerDigest(JSON.parse(JSON.stringify(value)));
const reference = evaluators.before(world, state, base), referenceHash = businessDigest(reference);
assert.deepEqual({ manifest: reference.compiledManifestDigest, projection: reference.projectionDigest, semantic: reference.semanticStateDigest }, expected);
evaluators.after(world, state, base); // Warm both implementations before timed pairs.
const rows = [];
try {
  for (let run = 1; run <= 5; run++) for (const variant of run % 2 ? ['before', 'after'] : ['after', 'before']) {
    counts = {}; const start = performance.now(), cpuStart = process.cpuUsage();
    const result = evaluators[variant](world, state, base), cpu = process.cpuUsage(cpuStart), duration = performance.now() - start;
    assert.equal(businessDigest(result), referenceHash, 'Full business output parity');
    rows.push({ run, variant, duration, cpuMs: (cpu.user + cpu.system) / 1000, counts, parity: true });
  }
} finally { globalThis.Date = NativeDate; }
fs.writeFileSync(output, JSON.stringify({ beforeRef, cutoff, rows, fullBusinessParity: true, remoteRequests: 0 }, null, 2) + '\n');
console.log(JSON.stringify({ rows, fullBusinessParity: true }));
