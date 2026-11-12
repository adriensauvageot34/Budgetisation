import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

// Existing B1 read-only and C8 durable localhost fixtures.
const readOnly = 'http://127.0.0.1:3158';
const durable = 'http://127.0.0.1:3147';
const require = createRequire(process.env.PLANNER_PLAYWRIGHT_TOOLS
  ? path.resolve(process.env.PLANNER_PLAYWRIGHT_TOOLS, 'package.json') : import.meta.url);
const { chromium } = require('playwright-core');
const output = process.env.COMPOSER_MONTH_BUDGET_OUTPUT ?? 'outputs/p21-month-budget-evidence';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, chromiumSandbox: true });
const errors = [];
const work = page => page.locator('[data-composer]');
const digest = page => work(page).getAttribute('data-digest');
const finances = async page => {
  await work(page).waitFor({ timeout: 120000 });
  await page.locator('[data-open-finances]').click();
  const panel = page.locator('[data-month-read]');
  await panel.waitFor();
  return panel;
};
const group = async (panel, key) => {
  const details = panel.locator(`[data-month-group="${key}"]`);
  if (await details.getAttribute('open') === null) await details.locator(':scope > summary').click();
  return details;
};
const listen = page => page.on('pageerror', error => errors.push(error.message));

try {
  for (const [width, height] of [[1280, 720], [390, 844], [360, 800]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    listen(page);
    await page.goto(readOnly + '/?impact=blocked');
    const panel = await finances(page);
    const before = await digest(page);
    assert.equal(await page.locator('[data-financial-preview]').getAttribute('data-financial-preview'), 'BLOCKED');
    assert.equal(await page.locator('[data-financial-completeness]').getAttribute('data-financial-completeness'), 'UNKNOWN');
    assert.equal(await page.locator('[data-financial-apply-readiness]').getAttribute('data-financial-apply-readiness'), 'BLOCKED');
    for (const provider of ['SWILE', 'EDENRED']) {
      const links = panel.locator('[data-month-missing] a');
      const url = new URL(await links.nth(provider === 'SWILE' ? 0 : 1).getAttribute('href'), readOnly);
      assert.equal(url.searchParams.get('month'), '2026-11');
      assert.equal(url.searchParams.get('focus'), `update:item:${provider}:loading`);
    }
    const funding = await group(panel, 'funding');
    assert.equal(await funding.locator('[data-knowledge="ABSENT"]').count(), 2);
    await page.screenshot({ path: path.join(output, `sources-${width}.png`) });
    const savings = await group(panel, 'savings');
    const protectedRow = savings.locator('[data-protected="true"]').filter({ hasText: 'Épargne protégée' });
    await protectedRow.locator('summary').click();
    assert.match(await protectedRow.innerText(), /Protection conservée/);
    const protectedEdit = protectedRow.getByRole('button', { name: 'Ajuster dans le brouillon' });
    if (await protectedEdit.count()) assert.equal(await protectedEdit.isEnabled(), false);
    const groceries = await group(panel, 'groceries');
    const target = groceries.locator('[data-courses-target]');
    if (await target.count()) await target.locator('xpath=ancestor::details[1]/summary').click();
    const layout = await panel.evaluate(node => {
      const dialog = node.closest('[data-financial-inspector]');
      const dock = [...document.querySelectorAll('[data-question-dock]')].find(item => item.getBoundingClientRect().height);
      const panelRect = dialog.getBoundingClientRect();
      return { document: document.documentElement.scrollWidth, overflow: dialog.scrollWidth - dialog.clientWidth,
        dockOverlap: dock ? panelRect.bottom - dock.getBoundingClientRect().top : 0 };
    });
    assert.equal(layout.document, width);
    assert(layout.overflow <= 1 && layout.dockOverlap <= 1, JSON.stringify(layout));
    await page.screenshot({ path: path.join(output, `courses-${width}.png`) });
    assert.equal(await digest(page), before);
    console.log(`Budget mensuel ${width}×${height} · sources, protections, Courses et disposition : PASS`);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  listen(page);
  const requests = [];
  page.on('request', request => {
    if (request.method() === 'POST') requests.push({ path: new URL(request.url()).pathname, kind: request.postDataJSON()?.kind });
  });
  await page.goto(readOnly + '/?impact=partial');
  let panel = await finances(page);
  const partial = (await group(panel, 'groceries')).locator('[data-month-grocery-impact="PARTIAL"]');
  assert.deepEqual((await partial.locator('dd').allTextContents()).map(text => text.replace(/\s/gu, '')), ['8,00€', '5,00€', '3,00€']);
  await page.goto(readOnly + '/?impact=retry');
  panel = await finances(page);
  const before = await digest(page);
  const retry = page.getByRole('button', { name: 'Actualiser les finances', exact: true });
  await retry.click();
  await work(page).locator('[data-financial-preview="FAILED"]').waitFor();
  await page.getByText('Projection et financement du mois', { exact: true }).click();
  assert.match(await page.locator('[data-finance-summary]').innerText(), /En attente de simulation/);
  assert.equal(await page.locator('[data-financial-apply-readiness]').count(), 0);
  await retry.click();
  await work(page).locator('[data-financial-preview="FRESH"]').waitFor();
  assert.equal(await digest(page), before);
  assert.deepEqual(requests, [{ path: '/read', kind: 'READ' }, { path: '/read', kind: 'READ' }]);
  console.log('Couverture partielle et réessai après échec · Compiler, READ seul, digest conservé : PASS');
  await page.close();

  const editPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  listen(editPage);
  const scenario = 'L1_MONTH_BUDGET_' + Date.now();
  const url = durable + '/?scenario=' + scenario + '&durable=1';
  const snapshot = async () => (await editPage.request.get(durable + '/draft?scenario=' + scenario)).json();
  await editPage.goto(url, { timeout: 120000 });
  const editPanel = await finances(editPage);
  assert.equal((await snapshot()).active, null);
  const target = (await group(editPanel, 'groceries')).locator('[data-courses-target]');
  await target.locator('xpath=ancestor::details[1]/summary').click();
  const targetRef = await target.getAttribute('data-courses-target');
  const initial = await digest(editPage);
  await target.getByRole('button', { name: 'Ajuster la cible', exact: true }).click();
  const raw = target.getByRole('textbox', { name: 'Nouvelle cible Courses (€)' });
  const save = target.getByRole('button', { name: 'Conserver la cible dans le brouillon' });
  await raw.fill('12,');
  await save.click();
  await target.getByRole('alert').waitFor();
  assert.equal(await raw.inputValue(), '12,');
  assert.equal(await digest(editPage), initial);
  assert.equal((await snapshot()).active, null);
  await raw.fill('350');
  await save.click();
  await editPage.locator('[data-draft-status][data-state="SAVED"]').waitFor({ timeout: 30000 });
  const after = await digest(editPage);
  assert.notEqual(after, initial);
  const stored = await snapshot();
  assert.equal(stored.active.semanticState.controls.find(row => row.decisionSlotKey === targetRef)?.value.amount, '350.00');
  assert.equal(stored.archives.length, 0);
  assert.equal(await work(editPage).getAttribute('data-revision'), '0');
  const saved = () => editPage.locator('[data-draft-status][data-state="SAVED"]').waitFor({ timeout: 30000 });
  await editPage.getByRole('button', { name: 'Fermer le panneau financier' }).click();
  await editPage.locator('[data-history-action="undo"]').click();
  await saved();
  assert.equal(await digest(editPage), initial);
  await editPage.locator('[data-history-action="redo"]').click();
  await saved();
  assert.equal(await digest(editPage), after);
  await editPage.reload({ timeout: 120000 });
  await work(editPage).waitFor();
  assert.equal(await digest(editPage), after);
  const reloaded = (await group(await finances(editPage), 'groceries')).locator('[data-courses-target]');
  await reloaded.locator('xpath=ancestor::details[1]/summary').click();
  assert.match(await reloaded.innerText(), /350,00/);
  const version = (await snapshot()).active.version;
  const originalWorld = await work(editPage).getAttribute('data-world-version');
  await reloaded.getByRole('button', { name: 'Ajuster la cible', exact: true }).click();
  await reloaded.getByRole('textbox', { name: 'Nouvelle cible Courses (€)' }).fill('360,50');
  // Simulate a reference publication arriving while the local form is open.
  await editPage.route('**/interaction?*', async route => {
    const response = await route.fetch();
    const result = await response.json();
    if (route.request().postDataJSON()?.kind === 'READ' && result.ok) {
      result.model.proof.expectedBaselineDigest = 'e'.repeat(64);
    }
    await route.fulfill({ response, json: result });
  }, { times: 1 });
  await editPage.getByRole('button', { name: 'Actualiser les finances' }).click();
  await editPage.waitForFunction(previous => document.querySelector('[data-composer]')?.getAttribute('data-world-version') !== previous, originalWorld);
  await reloaded.getByRole('button', { name: 'Conserver la cible dans le brouillon' }).click();
  assert.match(await reloaded.getByRole('alert').innerText(), /La référence ou le choix a changé/);
  assert.equal(await reloaded.getByRole('textbox', { name: 'Nouvelle cible Courses (€)' }).inputValue(), '360,50');
  assert.equal(await digest(editPage), after);
  assert.equal((await snapshot()).active.version, version);
  assert.deepEqual(errors, []);
  console.log('Saisie RAW, sauvegarde durable, Undo/Redo, Reload et refus de référence obsolète : PASS');
} finally {
  await browser.close();
}
