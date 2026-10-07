// Supplement the unchanged P0/P1 buckets with overlapping inclusive M7 subtrees.
// "instant transform" includes memo lookup and parsing, not just Instant.from.
import fs from 'node:fs';
const [profileFile, eventsFile, output] = process.argv.slice(2);
if (!profileFile || !eventsFile || !output) throw new Error('PROFILE_EVENTS_OUTPUT_REQUIRED');
const p = JSON.parse(fs.readFileSync(profileFile, 'utf8'));
const events = fs.readFileSync(eventsFile, 'utf8').trim().split('\n').map(JSON.parse);
const startup = events.find(e => e.type === 'startup'), root = events.find(e => e.type === 'span' && e.name === 'audit:complete-read-owner');
if (!startup?.hrtimeMicro || !root) throw new Error('OWNER_ALIGNMENT_REQUIRED');
const offset = startup.epoch - startup.hrtimeMicro / 1000, nodes = new Map(p.nodes.map(n => [n.id, n])), parents = new Map();
for (const node of p.nodes) for (const child of node.children ?? []) parents.set(child, node.id);
const labels = new Map();
function ancestry(id) {
  if (labels.has(id)) return labels.get(id);
  const frame = nodes.get(id)?.callFrame, inherited = parents.has(id) ? ancestry(parents.get(id)) : [];
  const result = [...inherited];
  if (frame?.url?.includes('/global-v2/mobility-context') && ['instant', 'overlaps', 'linkTemporalAssessment', 'resolvePairwisePresence'].includes(frame.functionName))
    result.push(frame.functionName);
  labels.set(id, result); return result;
}
let clock = p.startTime;
const inclusiveMs = {}, polyfillSelfMs = { temporal: 0, jsbi: 0 };
for (let i = 0; i < (p.samples?.length ?? 0); i++) {
  const delta = p.timeDeltas[i] ?? 0; clock += delta;
  const epoch = clock / 1000 + offset;
  if (epoch < root.start || epoch > root.end) continue;
  for (const label of new Set(ancestry(p.samples[i]))) inclusiveMs[label] = (inclusiveMs[label] ?? 0) + delta / 1000;
  const url = nodes.get(p.samples[i])?.callFrame.url ?? '';
  if (url.includes('@js-temporal/polyfill/')) polyfillSelfMs.temporal += delta / 1000;
  if (url.includes('/jsbi/')) polyfillSelfMs.jsbi += delta / 1000;
}
const result = { window: [root.start, root.end], inclusiveMs, polyfillSelfMs,
  note: 'Inclusive subtrees overlap. Instant includes lookup/parsing; Temporal self samples also include comparisons/date arithmetic. Do not add to the P0/P1 buckets.' };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
