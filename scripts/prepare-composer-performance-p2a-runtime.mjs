// Refresh only a marked disposable copy, using the existing P0/P1 probes.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const runtime = path.resolve(process.argv[2] ?? ''), repo = process.cwd();
if (!process.argv[2] || !fs.existsSync(path.join(runtime, 'audit-instrumentation.json')) || fs.existsSync(path.join(runtime, '.git')))
  throw new Error('MARKED_DISPOSABLE_RUNTIME_REQUIRED');
execFileSync(process.execPath, ['scripts/audit-composer-performance-runtime.mjs', runtime, '--refresh-probes'], { stdio: 'inherit', windowsHide: true });
for (const folder of ['src/core/time', 'src/analytics/facts']) fs.cpSync(path.join(repo, folder), path.join(runtime, folder), { recursive: true });
execFileSync(process.execPath, ['scripts/audit-composer-performance-experiment.mjs', runtime, 'baseline'], { stdio: 'inherit', windowsHide: true });
// Before A every instant() call is a parse. After A distinguish misses from calls.
// The existing diagnostic counter still counts all calls/overlaps identically.
const file = path.join(runtime, 'src/analytics/global-v2/mobility-context.ts');
const source = fs.readFileSync(file, 'utf8');
fs.writeFileSync(file, source.replace('const parsed = Temporal.Instant.from(value);',
  'const parseCounts=(globalThis as any).__auditWorkCounts;if(parseCounts)parseCounts.instantParses=(parseCounts.instantParses??0)+1;const parsed = Temporal.Instant.from(value);'));
console.log(JSON.stringify({ productChanged: false, runtime, actualParseCounter: source.includes('const parsed = Temporal.Instant.from(value);') }));
