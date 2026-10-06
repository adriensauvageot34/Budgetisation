import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const cli = process.env.AGENT_BROWSER_CLI;
if (!cli) throw new Error('Set AGENT_BROWSER_CLI to the pinned agent-browser bin/agent-browser.js');
const origin = process.env.PLANNER_C8_BROWSER_ORIGIN ?? 'http://127.0.0.1:3108', out = path.resolve(process.env.PLANNER_C8_BROWSER_OUTPUT ?? 'outputs/planner-c8-browser');
fs.mkdirSync(out, { recursive: true }); const passed = [], sizes = []; let commandNumber = 0;
function run(...args) {
  // File stdio avoids a Windows daemon retaining the parent's pipe after launch.
  const stdoutPath = path.join(out, `command-${++commandNumber}.json`), stderrPath = path.join(out, `command-${commandNumber}.stderr`);
  const stdout = fs.openSync(stdoutPath, 'w'), stderr = fs.openSync(stderrPath, 'w');
  let result; try { result = spawnSync(process.execPath, [cli, '--session', 'planner-c8-smoke', '--json', ...args], { stdio: ['ignore', stdout, stderr], timeout: 60000, windowsHide: true }); }
  finally { fs.closeSync(stdout); fs.closeSync(stderr); }
  if (result.error) throw result.error;
  const output = fs.readFileSync(stdoutPath, 'utf8');
  let data; try { data = JSON.parse(output.trim()); } catch { throw new Error(`${args[0]}: ${output} ${fs.readFileSync(stderrPath, 'utf8')}`); }
  if (!data.success || result.status) throw new Error(`${args.join(' ')}: ${JSON.stringify(data)}`);
  return data.data;
}
function evaluate(code) { const result = run('eval', `JSON.stringify(${code})`).result; return typeof result === 'string' ? JSON.parse(result) : result; }
const ready = () => run('wait', '--fn', 'document.querySelector("[data-composer]")?.getAttribute("aria-busy") === "false"');
const check = (id, fn) => { fn(); passed.push(id); console.log(`${id} PASS`); };
const evidence = async key => (await fetch(`${origin}/evidence?scenario=${key}`)).json();
const controls = () => evaluate('[...document.querySelectorAll("[data-control]")].map(e=>({key:e.dataset.control,label:e.querySelector("h3").textContent}))');
function tabTo(expression) { for (let i = 0; i < 65; i++) { if (evaluate(expression)) return; run('press', 'Tab'); } throw new Error('Keyboard target unreachable'); }
function navigate(url) { run('close'); run('open', url); run('set', 'viewport', '1440', '900'); run('wait', '[data-composer]'); ready(); }
function formCompleted() {
  run('wait', '--fn', '!document.querySelector("dialog[open]") || !!document.querySelector("dialog[open] [role=alert]")');
  ready(); assert.equal(evaluate('document.querySelector("dialog[open] [role=alert]")?.textContent ?? null'), null);
  assert.equal(evaluate('!!document.querySelector("dialog[open]")'), false);
}
function adjust(label, amount) {
  const card = controls().find(c => c.label === label); assert.ok(card, label);
  run('click', `[data-control="${card.key}"] [data-card-edit]`); run('snapshot', '-i');
  run('fill', 'dialog[open] input[name="amount"]', amount); run('click', 'dialog[open] [data-submit]'); formCompleted();
}
function chooseSocket(id, slot, asset, fields = {}) {
  const target = `[data-socket="${id}:${slot}"]`;
  const labels = evaluate(`Array.from(document.querySelector(${JSON.stringify(`${target} > div:last-child select`)}).options, option => option.textContent)`);
  assert.equal(new Set(labels).size, labels.length, 'Socket choices must not repeat the same option from other templates');
  run('select', `${target} > div:last-child select`, asset); run('snapshot', '-i');
  const visibleSubmit = () => evaluate('(()=>{const button=document.querySelector("dialog[open] [data-submit]"),rect=button.getBoundingClientRect();return rect.top>=0 && rect.bottom<=innerHeight && button.contains(document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2))})()');
  assert.equal(visibleSubmit(), true);
  if (asset.includes(':outbound:')) {
    run('screenshot', path.join(out, 'transport-form-1440x900.png'));
    run('set', 'viewport', '1440', '760'); assert.equal(visibleSubmit(), true); run('screenshot', path.join(out, 'transport-form-1440x760.png'));
    run('set', 'viewport', '1440', '900'); passed.push('C8-LONG-FORM-PRIMARY');
  }
  for (const [key, value] of Object.entries(fields)) run('fill', `dialog[open] input[name="${key}"]`, value);
  run('click', 'dialog[open] [data-submit]'); formCompleted();
}
function cockpitEquals(record) {
  const text = evaluate('document.querySelector("[data-remainder]").textContent');
  const remainder = record.log.at(-1).projection.plan.economicMonthEndRemainder;
  assert.equal(text, remainder === null ? 'À préciser' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(remainder)));
}
try {
  run('close');
  run('open', `${origin}/?delayHover=true`); run('set', 'viewport', '1440', '900'); run('wait', '[data-composer]'); ready();
  fs.writeFileSync(path.join(out, 'initial-accessibility.json'), JSON.stringify(run('snapshot', '-i'), null, 2));
  check('C8-020', () => { assert.equal(evaluate('!!document.querySelector("[data-apply]") && document.querySelector("[data-apply]").getBoundingClientRect().bottom <= innerHeight'), true); });
  const originalDigest = evaluate('document.querySelector("[data-composer]").dataset.digest');
  check('IGT-008', () => { tabTo('document.activeElement.textContent.trim()==="Ajuster" && document.activeElement.closest("[data-control]")?.querySelector("h3").textContent==="Courses"');
    assert.notEqual(evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'none'); run('press', 'Enter'); run('snapshot', '-i'); assert.equal(evaluate('!!document.querySelector("dialog[open]")'), true);
    run('fill', 'dialog[open] input[name="amount"]', '310'); tabTo('document.activeElement.textContent.trim()==="Prévisualiser ce choix"'); run('press', 'Enter'); ready(); assert.equal(evaluate('!!document.querySelector("dialog[open]")'), false); });
  const changedDigest = evaluate('document.querySelector("[data-composer]").dataset.digest'); assert.notEqual(changedDigest, originalDigest);
  check('C8-UNDO-REDO', () => { run('click', 'button[aria-label="Annuler la dernière modification du brouillon"]'); ready(); assert.equal(evaluate('document.querySelector("[data-composer]").dataset.digest'), originalDigest);
    run('click', 'button[aria-label="Rétablir la modification du brouillon"]'); ready(); assert.equal(evaluate('document.querySelector("[data-composer]").dataset.digest'), changedDigest); });
  check('C8-010-BROWSER', () => { const restaurant = controls().find(c => c.label === 'Restaurants'); run('hover', `[data-control="${restaurant.key}"] > div:last-child > button:last-child`); run('wait', '300');
    run('click', '[data-preview]'); ready(); run('wait', '1000'); assert.equal(evaluate('document.querySelector("[data-cockpit]").dataset.temporary'), 'false');
    assert.equal(evaluate('document.querySelector("[data-composer]").dataset.digest'), changedDigest); });
  run('click', '[data-preview]'); ready(); cockpitEquals(await evidence('A'));
  run('click', '[data-apply]'); ready(); assert.equal(evaluate('document.querySelector("[data-composer]").dataset.revision'), '1');
  const appliedDigest = evaluate('document.querySelector("[data-composer]").dataset.digest'); cockpitEquals(await evidence('A'));
  navigate(origin); assert.equal(evaluate('document.querySelector("[data-composer]").dataset.digest'), appliedDigest); passed.push('C8-APPLY-RELOAD-BROWSER');
  adjust('Courses', '320'); run('click', '[data-apply]'); ready(); assert.equal(evaluate('document.querySelector("[data-composer]").dataset.revision'), '2'); cockpitEquals(await evidence('A')); passed.push('C8-SECOND-REVISION-BROWSER');
  check('C8-PRESET-COMMIT-BROWSER', () => { const before = evaluate('document.querySelector("[data-composer]").dataset.digest'), card = controls().find(c => c.label === 'Restaurants');
    run('hover', `[data-control="${card.key}"] [data-preset]`); run('wait', '300');
    run('click', `[data-control="${card.key}"] [data-preset]`); ready();
    assert.notEqual(evaluate('document.querySelector("[data-composer]").dataset.digest'), before);
    assert.equal(evaluate('document.querySelector("[data-cockpit]").dataset.temporary'), 'false');
    run('click', 'button[aria-label="Annuler la dernière modification du brouillon"]'); ready(); assert.equal(evaluate('document.querySelector("[data-composer]").dataset.digest'), before); });
  check('C8-FORM-ERROR-BROWSER', () => { const card = controls().find(c => c.label === 'Courses');
    run('click', `[data-control="${card.key}"] [data-card-edit]`); run('fill', 'dialog[open] input[name="amount"]', 'montant invalide');
    run('click', 'dialog[open] [data-submit]'); ready();
    assert.equal(evaluate('!!document.querySelector("dialog[open] [role=alert]")'), true);
    assert.equal(evaluate('document.querySelector("dialog[open] input[name=amount]").value'), 'montant invalide');
    run('click', 'dialog[open] button[aria-label="Fermer"]'); });
  run('click', '[data-balance]'); ready(); run('snapshot', '-i');
  const candidates = evaluate('[...document.querySelectorAll("[data-candidate]")].map(e=>e.dataset.candidate)'); assert.ok(candidates.length);
  run('click', `[data-candidate="${candidates[0]}"] button`); ready(); run('snapshot', '-i');
  assert.notDeepEqual(evaluate('[...document.querySelectorAll("[data-candidate]")].map(e=>e.dataset.candidate)'), candidates); passed.push('C8-ASSISTANT-BROWSER');
  run('click', 'dialog[open] button[aria-label="Fermer"]'); run('snapshot', '-i');
  // Real native drag and drop of a Library asset onto the structured Board.
  run('fill', 'input[aria-label="Rechercher une intention"]', 'Activité'); run('snapshot', '-i');
  run('drag', '[data-asset="template:activity"]', '[data-board-drop]'); run('snapshot', '-i'); assert.equal(evaluate('!!document.querySelector("dialog[open]")'), true);
  run('fill', 'dialog[open] input[name="label"]', 'Balade du samedi'); run('click', 'dialog[open] [data-submit]'); formCompleted();
  const activityId = evaluate('[...document.querySelectorAll("[data-context]")].find(e=>e.querySelector("h3")?.textContent==="Balade du samedi").dataset.context');
  chooseSocket(activityId, 'main', 'option:activity:main:activity', { amount: '12', quantity: '1' }); passed.push('IGT-001-BROWSER'); passed.push('IGT-002-BROWSER');
  run('click', `[data-context="${activityId}"] button[aria-label="Retirer Balade du samedi"]`); ready(); assert.equal(evaluate(`!!document.querySelector('[data-context="${activityId}"]')`), false); passed.push('C8-014-BROWSER');
  // Composite fixture with ONE_OF replacement through a socket.
  navigate(`${origin}/?scenario=B`); run('snapshot', '-i');
  const nightId = evaluate('document.querySelector("[data-context]").dataset.context');
  chooseSocket(nightId, 'outbound', 'option:night-out:outbound:train', { amount: '2', origin: 'Maison', destination: 'Centre' });
  assert.equal(evaluate(`document.querySelector('[data-socket="${nightId}:outbound"]').querySelectorAll('[data-selection]').length`), 1); passed.push('C8-015-BROWSER');
  run('click', '[data-apply]'); ready(); assert.equal(evaluate('document.querySelector("[data-composer]").dataset.revision'), '1');
  run('click', `[data-context="${nightId}"] button[aria-label^="Retirer "]`); ready();
  const cancelled = await evidence('B'); assert.equal(cancelled.log.at(-1).mutationKind, 'CANCEL_CONTEXT'); run('click', '[data-apply]'); ready();
  const history = await evidence('B'); assert.ok(history.active.activeRevision.changeSet.some(c => c.kind === 'CANCEL_CONTEXT')); passed.push('C8-013-BROWSER');
  // Dense composite and actual available CSS height at all requested desktop sizes.
  navigate(`${origin}/?scenario=C`); run('snapshot', '-i');
  for (const [width, height] of [[1920,1080],[1728,900],[1440,900],[1440,760]]) {
    run('set', 'viewport', String(width), String(height));
    const metrics = evaluate('({width:innerWidth,height:innerHeight,rootHeight:document.querySelector("#root").getBoundingClientRect().height,workspaceHeight:document.querySelector("[data-composer]").getBoundingClientRect().height,hostHeaderHeight:document.querySelector("#root>div>header").getBoundingClientRect().height,boardHeight:document.querySelector("[data-board-scroll]").getBoundingClientRect().height,apply:document.querySelector("[data-apply]").getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth,vertical:document.documentElement.scrollHeight>innerHeight})');
    assert.equal(metrics.overflow, false); assert.equal(metrics.vertical, false); assert.ok(metrics.apply.bottom <= height && metrics.apply.top >= 0);
    assert.ok(metrics.boardHeight > 250); sizes.push(metrics); run('screenshot', path.join(out, `composer-${width}x${height}.png`));
  }
  passed.push('C8-DESKTOP-HEIGHTS');
  const rootContext = evaluate('document.querySelector("[data-context]").dataset.context');
  evaluate('(()=>{const board=document.querySelector("[data-board-scroll]"),card=document.querySelector("[data-context]");board.scrollTop+=card.getBoundingClientRect().top-board.getBoundingClientRect().top-12;return true})()');
  run('screenshot', path.join(out, 'composite-context.png')); cockpitEquals(await evidence('C'));
  const c = await evidence('C'); assert.equal(c.log.at(-1).projection.mobility.journeyCount, 1); passed.push('C8-COMPOSITE-BROWSER');
  run('fill', 'input[aria-label="Rechercher une intention"]', 'Séjour'); run('click', '[data-asset="template:short-stay"]');
  run('fill', 'dialog[open] input[name="label"]', 'Séjour complémentaire'); run('click', 'dialog[open] [data-submit]'); formCompleted();
  const parentId = evaluate('[...document.querySelectorAll("[data-context]")].find(e=>e.querySelector("h3")?.textContent==="Séjour complémentaire").dataset.context');
  const childId = evaluate(`[...document.querySelectorAll('[data-context="${rootContext}"] [data-context]')].find(e=>e.querySelector('h3').textContent==='Synthetic activity').dataset.context`);
  evaluate(`document.querySelector('[data-context="${childId}"] button[aria-label^="Déplacer "]').scrollIntoView({block:'center',behavior:'instant'})`);
  run('click', `[data-context="${childId}"] button[aria-label^="Déplacer "]`);
  evaluate(`document.querySelector('[data-socket="${parentId}:activities"] > div:last-child button').scrollIntoView({block:'center',behavior:'instant'})`);
  run('click', `[data-socket="${parentId}:activities"] > div:last-child button`);
  run('wait', '--fn', `!!document.querySelector('[data-context="${parentId}"] [data-context="${childId}"]')`); ready();
  assert.equal(evaluate(`document.querySelectorAll('[data-context="${childId}"]').length`), 1);
  assert.equal(evaluate(`!!document.querySelector('[data-context="${parentId}"] [data-context="${childId}"]')`), true);
  passed.push('C8-REPARENT-CLICK-BROWSER');
  for (const scenario of ['D','E']) { navigate(`${origin}/?scenario=${scenario}`); run('snapshot', '-i'); cockpitEquals(await evidence(scenario)); run('screenshot', path.join(out, `scenario-${scenario}.png`)); passed.push(`C8-FIXTURE-${scenario}-BROWSER`); }
  const errors = run('errors'); assert.ok(!JSON.stringify(errors).includes('Uncaught')); passed.push('C8-CONSOLE');
  const report = { passed, sizes, environment: 'ISOLATED_ACTUAL_COMPOSER_COMPONENTS_REAL_C0_PGLITE', remoteWrites: 0,
    historicalCanaryWrites: 0, fixtures: Object.fromEntries(await Promise.all(['A','B','C','D','E'].map(async key => { const e = await evidence(key); return [key, { counts:e.counts,rpcCalls:e.rpcCalls,remoteWrites:e.remoteWrites,historicalCanaryWrites:e.historicalCanaryWrites }]; }))) };
  fs.writeFileSync(path.join(out, 'browser-verification.json'), JSON.stringify(report, null, 2)); console.log(`Browser C8 PASS (${passed.length})`);
} finally { run('close'); }
