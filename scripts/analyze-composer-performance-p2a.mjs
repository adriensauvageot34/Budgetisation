// Aggregate the unchanged P0/P1 probes; publish metadata/digests only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const [root] = process.argv.slice(2);
if (!root) throw new Error('P2A_OUTPUT_ROOT_REQUIRED');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const events = folder => fs.existsSync(folder) ? fs.readdirSync(folder).filter(file => /^server-.*\.jsonl$/.test(file))
  .flatMap(file => fs.readFileSync(path.join(folder, file), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse)) : [];
function stats(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b), n = sorted.length;
  return n ? { n, min: sorted[0], median: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
    p95: sorted[Math.ceil(n * .95) - 1], max: sorted.at(-1) } : null;
}
function owner(folder) {
  const file = path.join(folder, 'owner-runs.json');
  if (!fs.existsSync(file)) return null;
  const rows = read(file), trace = events(folder), roots = trace.filter(e => e.type === 'span' && e.name === 'audit:complete-read-owner');
  const samples = roots.map(root => {
    const inRoot = e => e.pid === root.pid && e.root === root.id;
    const spans = trace.filter(e => inRoot(e) && e.type === 'span'), fetches = trace.filter(e => inRoot(e) && e.type === 'fetch');
    const matching = pattern => spans.filter(s => pattern.test(s.name));
    return { duration: root.duration, m7Total: matching(/global-v2-mobility-context-authority.*resolveGlobalM7MobilityContextAuthority$/)[0]?.duration,
      m7Sync: matching(/^audit:mobility-context-builder$/)[0]?.duration,
      compile: matching(/:compileSemanticPlan$/).length, derive: matching(/:deriveMonthScenario$/).length,
      evaluationCpu: matching(/:compileSemanticPlan$|:deriveMonthScenario$/).reduce((sum, s) => sum + s.duration, 0),
      get: fetches.filter(e => e.business && e.method === 'GET').length, auth: fetches.filter(e => !e.business).length,
      queryFingerprint: crypto.createHash('sha256').update(JSON.stringify(fetches.filter(e => e.business && e.method === 'GET').map(e => e.exact).sort())).digest('hex'),
      decodedBytes: trace.filter(e => inRoot(e) && e.type === 'body' && e.path?.startsWith('/rest/v1/')).reduce((sum, e) => sum + e.bytes, 0),
      payload: trace.find(e => inRoot(e) && e.type === 'payload')?.bytes };
  });
  return { wall: stats(rows.filter(r => !r.error).map(r => r.duration)), cpu: stats(rows.filter(r => !r.error).map(r => r.cpuMs)),
    m7Total: stats(samples.map(s => s.m7Total)), m7Sync: stats(samples.map(s => s.m7Sync)), evaluationCpu: stats(samples.map(s => s.evaluationCpu)),
    work: rows.map(r => r.work), samples, parity: rows.map(r => Object.fromEntries(Object.entries(r).filter(([key]) => /Digest$|^uiBytes$|^counts$/.test(key)))),
    failures: rows.filter(r => r.error), blocked: trace.filter(e => e.blocked).length,
    remoteWrites: trace.filter(e => e.type === 'fetch' && e.business && !['GET', 'HEAD'].includes(e.method) && !e.blocked).length,
    errors: trace.filter(e => e.error).map(e => ({ type: e.type, name: e.name, path: e.path, error: e.error })) };
}
function browser(folder, mode) {
  const file = path.join(folder, `${mode}-runs.json`);
  if (!fs.existsSync(file)) return null;
  const rows = read(file), success = rows.filter(r => !r.failed && r.page);
  return { tti: stats(success.map(r => r.page.interactiveFromWall)), firstResponse: stats(success.map(r => {
    if (mode !== 'client') return r.page.navigation?.responseStart;
    const req = r.network.find(n => n.type === 'Fetch' && n.path.includes('composer'));
    return req?.headersAt - req?.start;
  })), completedResponse: stats(success.map(r => {
    if (mode !== 'client') return r.page.navigation?.responseEnd;
    const req = r.network.find(n => n.type === 'Fetch' && n.path.includes('composer'));
    return req?.end - req?.start;
  })), rows: success.map(r => ({ run: r.run, tti: r.page.interactiveFromWall, viewport: r.page.viewport,
    requests: r.network.length, bytes: r.network.reduce((sum, n) => sum + (n.encodedBytes ?? 0), 0),
    errors: r.errors, blocked: r.blocked, interaction: r.page.interaction })), failures: rows.filter(r => r.failed).map(r => r.failed) };
}
const phases = {};
for (const phase of ['baseline', 'a', 'ab', 'abc', 'final']) {
  const folder = path.join(root, phase), browserFolder = fs.existsSync(path.join(folder, 'browser-retry')) ? path.join(folder, 'browser-retry') : path.join(folder, 'browser');
  phases[phase] = { replay: owner(path.join(folder, 'replay')), real: owner(path.join(folder, 'owner-real')),
    browser: Object.fromEntries(['hard', 'client', 'cold'].map(mode => [mode, browser(browserFolder, mode)])) };
}
const reference = phases.baseline.replay?.parity[0], parityRows = Object.values(phases).flatMap(p => p.replay?.parity ?? []);
const same = value => JSON.stringify(value) === JSON.stringify(reference);
const serverTrace = Object.keys(phases).flatMap(phase => [
  ...events(path.join(root, phase, 'server-browser')),
  ...events(path.join(root, phase, 'browser', 'server')),
  ...events(path.join(root, phase, 'browser-retry', 'server')),
]);
const requests = serverTrace.filter(e => e.type === 'http' && /^http:GET:\/mois-a-venir\/composer$/.test(e.name));
const requestCounts = requests.map(request => ({ duration: request.duration, status: request.status,
  get: serverTrace.filter(e => e.pid === request.pid && e.root === request.id && e.type === 'fetch' && e.business && e.method === 'GET').length }));
const summary = { phases, offlineParity: { runs: parityRows.length, identical: parityRows.every(same), reference },
  browserServerRequests: requestCounts, remoteWrites: serverTrace.filter(e => e.type === 'fetch' && e.business && !['GET', 'HEAD'].includes(e.method) && !e.blocked).length,
  browserBlocked: serverTrace.filter(e => e.blocked).length };
fs.writeFileSync(path.join(root, 'public-summary.json'), JSON.stringify(summary, null, 2) + '\n');
if (process.argv.includes('--certify')) {
  assert.ok(parityRows.length >= 25 && parityRows.every(same), '25 strict offline replays');
  const referenceQueries = phases.baseline.replay.samples[0].queryFingerprint;
  for (const phase of Object.values(phases)) for (const owner of [phase.real, phase.replay]) {
    assert.ok(owner && !owner.failures.length && !owner.errors.length && !owner.blocked && !owner.remoteWrites);
    assert.ok(owner.parity.every(same), 'Real/replay business parity');
    assert.ok(owner.samples.every(s => s.get === 313 && s.queryFingerprint === referenceQueries), 'Identical headless query set');
  }
  assert.ok(requestCounts.length && requestCounts.every(r => r.get === 291 && r.status === 200), '291 unchanged browser GETs');
  assert.equal(summary.remoteWrites, 0); assert.equal(summary.browserBlocked, 0);
  for (const mode of ['hard', 'client']) {
    const browser = phases.final.browser[mode];
    assert.ok(browser && browser.tti.n >= 5 && !browser.failures.length);
    assert.ok(browser.rows.every(r => !r.errors.length && !r.blocked && r.viewport.width === 1728 && r.viewport.height === 900));
  }
  assert.equal(phases.final.real.wall.n, 5);
  assert.ok(phases.final.replay.samples.every(s => s.compile === 1 && s.derive === 1));
  assert.ok(phases.final.replay.work.every(w => w.instantParses === 3344 && w.zoneValidations === 2));
  console.log('P2A_MEASUREMENT_CERTIFICATION PASS');
}
console.log(JSON.stringify({ phases: Object.fromEntries(Object.entries(phases).map(([key, p]) => [key, {
  replay: p.replay?.wall, real: p.real?.wall, m7: p.real?.m7Sync, work: p.replay?.work[0], hard: p.browser.hard?.tti, client: p.browser.client?.tti }])),
  offlineParity: summary.offlineParity, browserGETCounts: [...new Set(requestCounts.map(r => r.get))], remoteWrites: summary.remoteWrites }, null, 2));
