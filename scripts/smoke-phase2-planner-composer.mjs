import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inventoryNavigator } from './lib/planner-browser-inventory.mjs';
const cli = process.env.AGENT_BROWSER_CLI;
if (!cli) throw new Error('Set AGENT_BROWSER_CLI to the pinned agent-browser bin/agent-browser.js');
const origin = process.env.PLANNER_C8_BROWSER_ORIGIN ?? 'http://127.0.0.1:3108', out = path.resolve(process.env.PLANNER_C8_BROWSER_OUTPUT ?? 'outputs/planner-c8-browser');
fs.mkdirSync(out, { recursive: true }); const passed = [], sizes = []; let commandNumber = 0;
function run(...args) {
  if (!navigating && ['click','hover','focus','fill','scrollintoview'].includes(args[0])) reveal(args[1]);
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
const reveal = inventoryNavigator((...args) => rawRun(...args), evaluate);
// Navigator commands must bypass the selector hook to avoid re-entering it.
function rawRun(...args) { const saved = navigating; navigating = true; try { return run(...args); } finally { navigating = saved; } }
let navigating = false;
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
  run('click', `${target} > button:first-of-type`);
  const choice = '[data-atomic-popover]:popover-open [data-socket-choice]';
  const labels = evaluate(`Array.from(document.querySelector(${JSON.stringify(choice)}).options, option => option.textContent)`);
  assert.equal(new Set(labels).size, labels.length, 'Socket choices must not repeat the same option from other templates');
  run('select', choice, asset); run('snapshot', '-i');
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
  check('R1-UNIFIED-BOARD', () => {
    assert.equal(evaluate('document.querySelectorAll("[data-composer] aside").length'), 1);
    assert.equal(evaluate('[...document.querySelectorAll("[data-composer] h2")].some(e=>["Socle du mois","Vie & envies","Contexts & projets","Cagnottes","Cap du mois"].includes(e.textContent))'), false);
    assert.equal(evaluate('!!document.querySelector("[data-mosaic]") && !!document.querySelector("[data-add-element]")'), true);
    assert.equal(evaluate('document.querySelector("[data-cockpit]").closest("header") !== null'), true);
  });
  check('R1-DETAILS-FOCUS', () => { run('click', '[data-financial-details]'); run('snapshot', '-i');
    assert.equal(evaluate('document.querySelector("dialog[open] h2").textContent'), 'Le détail de votre mois');
    assert.equal(evaluate('document.querySelector("dialog[open]").textContent.includes("Financement & timing")'), true);
    run('press', 'Escape'); assert.equal(evaluate('document.activeElement.hasAttribute("data-financial-details")'), true);
  });
  check('R1-ADD-ENTRY', () => { const before = evaluate('document.querySelector("[data-composer]").dataset.digest');
    run('click', '[data-add-element]'); assert.equal(evaluate('document.activeElement.getAttribute("aria-label")'), 'Rechercher une intention');
    assert.equal(evaluate('document.querySelector("[data-composer]").dataset.digest'), before);
    run('click', '[data-asset="template:activity"]'); run('snapshot', '-i');
    assert.equal(evaluate('document.querySelector("dialog[open] h2").textContent'), 'Composer Activité');
    run('press', 'Escape');
  });
  check('C8-020', () => { assert.equal(evaluate('!!document.querySelector("[data-apply]") && document.querySelector("[data-apply]").getBoundingClientRect().bottom <= innerHeight'), true); });
  const originalDigest = evaluate('document.querySelector("[data-composer]").dataset.digest');
  check('IGT-008', () => { tabTo('document.activeElement.textContent.trim()==="Ajuster" && document.activeElement.closest("[data-control]")?.querySelector("h3").textContent==="Courses"');
    assert.notEqual(evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'none'); run('press', 'Enter'); run('snapshot', '-i'); assert.equal(evaluate('!!document.querySelector("dialog[open]")'), true);
    run('fill', 'dialog[open] input[name="amount"]', '310'); tabTo('document.activeElement.textContent.trim()==="Prévisualiser ce choix"'); run('press', 'Enter'); ready(); assert.equal(evaluate('!!document.querySelector("dialog[open]")'), false); });
  const changedDigest = evaluate('document.querySelector("[data-composer]").dataset.digest'); assert.notEqual(changedDigest, originalDigest);
  check('C8-UNDO-REDO', () => { run('click', 'button[aria-label="Annuler la dernière modification du brouillon"]'); ready(); assert.equal(evaluate('document.querySelector("[data-composer]").dataset.digest'), originalDigest);
    run('click', 'button[aria-label="Rétablir la modification du brouillon"]'); ready(); assert.equal(evaluate('document.querySelector("[data-composer]").dataset.digest'), changedDigest); });
  check('C8-010-BROWSER', () => { const restaurant = controls().find(c => c.label === 'Restaurants'); run('hover', `[data-control="${restaurant.key}"] [data-preset]`); run('wait', '300');
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
  run('click', `[data-candidate="${candidates[0]}"]`); ready(); run('snapshot', '-i');
  assert.notDeepEqual(evaluate('[...document.querySelectorAll("[data-candidate]")].map(e=>e.dataset.candidate)'), candidates); passed.push('C8-ASSISTANT-BROWSER');
  run('click', 'button[aria-label="Fermer les suggestions"]'); run('snapshot', '-i');
  // Real native drag and drop of a Library asset onto the structured Board.
  run('fill', 'input[aria-label="Rechercher une intention"]', 'Activité'); run('snapshot', '-i');
  run('drag', '[data-asset="template:activity"]', '[data-add-element]'); ready(); run('snapshot', '-i'); assert.equal(evaluate('!!document.querySelector("[data-context]")'), true);
  run('click', '[data-context] button[aria-label^="Modifier les informations"]');
  run('fill', 'dialog[open] input[name="label"]', 'Balade du samedi'); run('click', 'dialog[open] [data-submit]'); formCompleted();
  const activityId = evaluate('[...document.querySelectorAll("[data-context]")].find(e=>e.querySelector("h3")?.textContent==="Balade du samedi").dataset.context');
  chooseSocket(activityId, 'main', 'option:activity:main:activity', { amount: '12', quantity: '1' }); passed.push('IGT-001-BROWSER'); passed.push('IGT-002-BROWSER');
  run('click', `[data-context="${activityId}"] [data-context-actions]`); run('click', `[data-context="${activityId}"] button[aria-label="Retirer Balade du samedi"]`); ready(); assert.equal(evaluate(`!!document.querySelector('[data-context="${activityId}"]')`), false); passed.push('C8-014-BROWSER');
  // Composite fixture with ONE_OF replacement through a socket.
  navigate(`${origin}/?scenario=B`); run('snapshot', '-i');
  const nightId = evaluate('document.querySelector("[data-context]").dataset.context');
  chooseSocket(nightId, 'outbound', 'option:night-out:outbound:train', { amount: '2', origin: 'Maison', destination: 'Centre' });
  assert.equal(evaluate(`document.querySelector('[data-socket="${nightId}:outbound"]').querySelectorAll('[data-selection]').length`), 1); passed.push('C8-015-BROWSER');
  run('click', '[data-apply]'); ready(); assert.equal(evaluate('document.querySelector("[data-composer]").dataset.revision'), '1');
  run('click', `[data-context="${nightId}"] [data-context-actions]`); run('click', `[data-context="${nightId}"] button[aria-label^="Retirer "]`); ready();
  const cancelled = await evidence('B'); assert.equal(cancelled.log.at(-1).mutationKind, 'CANCEL_CONTEXT'); run('click', '[data-apply]'); ready();
  const history = await evidence('B'); assert.ok(history.active.activeRevision.changeSet.some(c => c.kind === 'CANCEL_CONTEXT')); passed.push('C8-013-BROWSER');
  // Dense composite and actual available CSS height at all requested desktop sizes.
  navigate(`${origin}/?scenario=C`); run('snapshot', '-i');
  for (const [width, height] of [[1920,1080],[1728,900],[1440,900],[1440,760]]) {
    run('set', 'viewport', String(width), String(height));
    const metrics = evaluate('({width:innerWidth,height:innerHeight,rootHeight:document.querySelector("#root").getBoundingClientRect().height,workspaceHeight:document.querySelector("[data-composer]").getBoundingClientRect().height,workspaceWidth:document.querySelector("[data-composer]").getBoundingClientRect().width,hostHeaderHeight:document.querySelector("#root>div>header").getBoundingClientRect().height,boardHeight:document.querySelector("[data-board-scroll]").getBoundingClientRect().height,boardWidth:document.querySelector("[data-board-scroll]").getBoundingClientRect().width,libraryWidth:document.querySelector("[data-composer] aside").getBoundingClientRect().width,hud:document.querySelector("[data-cockpit]").getBoundingClientRect().toJSON(),apply:document.querySelector("[data-apply]").getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth,vertical:document.documentElement.scrollHeight>innerHeight})');
    assert.equal(metrics.overflow, false); assert.equal(metrics.vertical, false); assert.ok(metrics.apply.bottom <= height && metrics.apply.top >= 0);
    assert.ok(metrics.boardHeight > 250); sizes.push(metrics); run('screenshot', path.join(out, `composer-${width}x${height}.png`));
    assert.ok(metrics.libraryWidth >= 230 && metrics.libraryWidth <= 280);
    assert.ok(metrics.boardWidth > metrics.workspaceWidth - 576, 'Board must recover the former right cockpit space');
    assert.ok(metrics.hud.left >= 0 && metrics.hud.right <= width && metrics.hud.bottom <= height);
    assert.equal(evaluate('(()=>{const el=document.querySelector("[data-apply]"),r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})()'), true);
  }
  passed.push('C8-DESKTOP-HEIGHTS');
  const rootContext = evaluate('document.querySelector("[data-context]").dataset.context');
  evaluate('(()=>{const board=document.querySelector("[data-board-scroll]"),card=document.querySelector("[data-context]");board.scrollTop+=card.getBoundingClientRect().top-board.getBoundingClientRect().top-12;return true})()');
  run('screenshot', path.join(out, 'composite-context.png')); cockpitEquals(await evidence('C'));
  const c = await evidence('C'); assert.equal(c.log.at(-1).projection.mobility.journeyCount, 1); passed.push('C8-COMPOSITE-BROWSER');
  check('R2-NESTED-EDITOR-BROWSER', () => {
    run('click', `[data-socket="${rootContext}:restaurants"] > button[data-selection]`);
    assert.equal(evaluate('[...document.querySelector("[data-atomic-popover]:popover-open").children].filter(e=>e.tagName==="DIV").some(e=>[...e.querySelectorAll("button")].some(b=>b.textContent==="Modifier"))'), false);
    run('click', '[data-atomic-popover]:popover-open [data-context] button[aria-label^="Modifier les informations"]');
    assert.equal(evaluate('!!document.querySelector("dialog[open] input[name=label]")'), true);
    run('press', 'Escape'); assert.equal(evaluate('document.activeElement.hasAttribute("data-satellite")'), true);
    assert.equal(evaluate('document.activeElement.getClientRects().length>0'), true);
  });
  run('fill', 'input[aria-label="Rechercher une intention"]', 'Séjour'); run('click', '[data-asset="template:short-stay"]');
  run('fill', 'dialog[open] input[name="label"]', 'Séjour complémentaire'); run('click', 'dialog[open] [data-submit]'); formCompleted();
  const parentId = evaluate('[...document.querySelectorAll("[data-context]")].find(e=>e.querySelector("h3")?.textContent==="Séjour complémentaire").dataset.context');
  const childId = evaluate(`[...document.querySelectorAll('[data-context="${rootContext}"] [data-context]')].find(e=>e.querySelector('h3').textContent==='Synthetic activity').dataset.context`);
  run('click', `[data-socket="${rootContext}:activities"] > button[data-selection]`);
  evaluate(`document.querySelector('[data-context="${childId}"] button[aria-label^="Déplacer "]').scrollIntoView({block:'center',behavior:'instant'})`);
  run('click', `[data-context="${childId}"] button[aria-label^="Déplacer "]`);
  run('click', `[data-socket="${parentId}:activities"] > button:first-of-type`);
  run('click', '[data-atomic-popover]:popover-open [data-snap]');
  run('wait', '--fn', `!!document.querySelector('[data-context="${parentId}"] [data-context="${childId}"]')`); ready();
  assert.equal(evaluate(`document.querySelectorAll('[data-context="${childId}"]').length`), 1);
  assert.equal(evaluate(`!!document.querySelector('[data-context="${parentId}"] [data-context="${childId}"]')`), true);
  passed.push('C8-REPARENT-CLICK-BROWSER');
  for (const scenario of ['D','E']) { navigate(`${origin}/?scenario=${scenario}`); run('snapshot', '-i'); cockpitEquals(await evidence(scenario)); run('screenshot', path.join(out, `scenario-${scenario}.png`)); passed.push(`C8-FIXTURE-${scenario}-BROWSER`); }
  // Atomic grammar uses the actual production components and certified synthetic owners.
  navigate(`${origin}/?scenario=R`); run('snapshot', '-i');
  check('R2-008-BROWSER', () => assert.equal(evaluate('!!document.querySelector("[data-context-palette]")'), false));
  run('screenshot', path.join(out, 'board-rest.png'));
  const atomicId = evaluate('document.querySelector("[data-context]").dataset.context');
  check('R2-001-BROWSER', () => { assert.equal(evaluate(`document.querySelector('[data-context="${atomicId}"]').querySelectorAll('[data-satellite][data-selection]').length`), 4);
    assert.equal(evaluate(`document.querySelector('[data-socket="${atomicId}:before"]').parentElement.dataset.orbit`), 'NORTH'); });
  check('R2-002-BROWSER', () => assert.equal(evaluate(`document.querySelector('[data-context="${atomicId}"]').querySelectorAll('[data-satellite][data-empty]').length`), 2));
  run('click', `[data-context="${atomicId}"] [data-context-focus]`);
  check('R2-007-BROWSER', () => { assert.equal(evaluate('document.querySelector("[data-context-palette]").dataset.contextPalette'), atomicId);
    assert.equal(evaluate(`document.querySelector('[data-context="${atomicId}"]').dataset.focused`), 'true');
    assert.equal(evaluate(`(()=>{const card=document.querySelector('[data-context="${atomicId}"]').getBoundingClientRect(),board=document.querySelector('[data-board-scroll]').getBoundingClientRect();return card.top>=board.top && card.bottom<=board.bottom})()`), true);
  });
  run('screenshot', path.join(out, 'night-selected.png'));
  check('R2-009-BROWSER', () => assert.ok(evaluate('document.querySelectorAll("[data-context-palette] [data-option-state=ALTERNATIVE]").length') > 0));
  check('R2-003-BROWSER', () => assert.equal(evaluate(`document.querySelector('[data-socket="${atomicId}:before"] [data-satellite]').dataset.state`), 'SUGGESTED'));
  check('R2-012-BROWSER', () => { run('focus', `[data-socket="${atomicId}:before"] [data-satellite]`); run('press', 'Enter');
    assert.equal(evaluate('!!document.querySelector("[data-atomic-popover]:popover-open")'), true);
    assert.equal(evaluate('!!document.activeElement.closest("[data-atomic-popover]:popover-open")'), true);
    const rect = evaluate('document.querySelector("[data-atomic-popover]:popover-open").getBoundingClientRect().toJSON()');
    assert.ok(rect.left >= 0 && rect.right <= 1440 && rect.top >= 0 && rect.bottom <= 900);
    run('screenshot', path.join(out, 'before-popover.png')); run('press', 'Escape');
    assert.equal(evaluate('!!document.querySelector("[data-atomic-popover]:popover-open")'), false);
    assert.equal(evaluate('document.activeElement.dataset.state'), 'SUGGESTED');
  });
  check('R2-005-BROWSER', () => { run('click', `[data-socket="${atomicId}:food"] [data-satellite]`);
    assert.equal(evaluate('document.querySelector("[data-atomic-popover]:popover-open").textContent.includes("Retenu : À préciser")'), true); run('press', 'Escape'); });
  check('R2-PROTECTED-BROWSER', () => { assert.equal(evaluate('!!document.querySelector("[data-protected=true] [data-card-edit]")'), false);
    assert.equal(evaluate('!!document.querySelector("[data-protected=true] button[aria-label^=Retirer]")'), false);
    run('click', '[data-context-palette] button[aria-label="Quitter la sélection du moment"]');
    run('scrollintoview','[data-protected=true]');
    run('screenshot', path.join(out, 'protected-savings.png'));
  });
  check('R2-011-BROWSER', () => assert.equal(evaluate('/\\p{Extended_Pictographic}/u.test(document.querySelector("[data-composer]").textContent)'), false));
  const atomicEvidence = await evidence('R'); assert.equal(atomicEvidence.rpcCalls, 0); assert.equal(atomicEvidence.counts.plans, 0);
  passed.push('R2-READ-ZERO-WRITES-BROWSER');
  navigate(`${origin}/?scenario=C`); run('click', '[data-context]:not([data-context] [data-context]) [data-context-focus]');
  run('screenshot', path.join(out, 'weekend-composite.png'));
  for (const scenario of ['A','B','C','D','E','R']) assert.ok((await evidence(scenario)).log.every(request => request.uiPayloadFields.length === 0));
  passed.push('R2-013-BROWSER');
  const errors = run('errors'); assert.ok(!JSON.stringify(errors).includes('Uncaught')); passed.push('C8-CONSOLE');
  const report = { passed, sizes, environment: 'ISOLATED_ACTUAL_COMPOSER_COMPONENTS_REAL_C0_PGLITE', remoteWrites: 0,
    historicalCanaryWrites: 0, fixtures: Object.fromEntries(await Promise.all(['A','B','C','D','E','R'].map(async key => { const e = await evidence(key); return [key, { counts:e.counts,rpcCalls:e.rpcCalls,remoteWrites:e.remoteWrites,historicalCanaryWrites:e.historicalCanaryWrites }]; }))) };
  fs.writeFileSync(path.join(out, 'browser-verification.json'), JSON.stringify(report, null, 2)); console.log(`Browser C8 PASS (${passed.length})`);
} finally { run('close'); }
