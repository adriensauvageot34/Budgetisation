import fs from 'node:fs';
import assert from 'node:assert/strict';
// Execute the existing guard verbatim, without repeating unrelated C8 services.
const source=fs.readFileSync('scripts/check-phase2-planner-composer.mjs','utf8');
const start=source.indexOf("  await check('C8-017'"),end=source.indexOf("  await check('C8-HISTORICAL-WRITES'",start);
assert.ok(start>=0&&end>start);
const run=new (Object.getPrototypeOf(async function(){}).constructor)('check','fs','assert',source.slice(start,end));
await run(async(name,fn)=>{assert.equal(name,'C8-017');await fn();console.log(name+' EXECUTED_PASS_ORIGINAL_ASSERTION_ISOLATED');},fs,assert);
