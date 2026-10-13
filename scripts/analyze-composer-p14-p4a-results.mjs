import fs from 'node:fs';

// Only synthetic, browser-recorded P4A metrics are accepted as input.
// Quantiles use the nearest-rank definition so small sample sizes stay visible.
const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/analyze-composer-p14-p4a-results.mjs <client-metrics.json>');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const samples = data.samples.filter(sample => sample.trusted && sample.visibility === 'visible');
const quantiles = values => {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  const rank = q => sorted.length ? Math.round(sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] * 10) / 10 : null;
  return { n: sorted.length, p50: rank(0.5), p95: rank(0.95) };
};
const groups = Object.groupBy(samples, sample => sample.label);
const perGesture = Object.fromEntries(Object.entries(groups).map(([label, rows]) => [label, {
  paintUpperMs: quantiles(rows.map(row => row.paintUpperMs)),
  commitMs: quantiles(rows.map(row => row.commitMs)),
  stateMs: quantiles(rows.map(row => row.stateMs)),
  domMs: quantiles(rows.map(row => row.domMs)),
  nodes: quantiles(rows.map(row => row.nodes)),
}]));
console.log(JSON.stringify({ file, samples: samples.length, viewport: samples[0]?.viewport ?? null,
  all: { paintUpperMs: quantiles(samples.map(row => row.paintUpperMs)), commitMs: quantiles(samples.map(row => row.commitMs)),
    stateMs: quantiles(samples.map(row => row.stateMs)), domMs: quantiles(samples.map(row => row.domMs)) },
  gestures: perGesture, longTasks: data.longTasks?.length ?? 0,
  rectCalls: data.rectCalls ?? null, rectMs: data.rectMs ?? null,
  heapStart: data.heapStart ?? null, heapEnd: data.heapEnd ?? null,
  transport: Object.fromEntries(Object.entries(Object.groupBy(data.requests ?? [], request => request.kind))
    .map(([kind, rows]) => [kind, { completed: rows.length, durationMs: quantiles(rows.map(row => row.ms)) }])),
}, null, 2));
