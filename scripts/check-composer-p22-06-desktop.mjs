import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(process.env.PLANNER_PLAYWRIGHT_PACKAGE ?? new URL('../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const out = path.resolve(process.env.COMPOSER_C8_RESULTS_DIR ?? 'outputs/p22-06/browser') + path.sep;
await fs.mkdir(out, { recursive: true });
const origin = 'http://127.0.0.1:' + (process.env.COMPOSER_C8_TEST_PORT ?? '3158');
const run = Date.now();
const results = [];
const nativeZoom = process.env.P22_NATIVE_ZOOM === '1';
const launch = { channel: 'chrome', headless: true, chromiumSandbox: true };
const persistent = nativeZoom ? await chromium.launchPersistentContext(fileURLToPath(new URL('file:///' + path.resolve(out, 'chrome-125-profile').replaceAll(String.fromCharCode(92), '/') + '/')), { ...launch, viewport: { width: 1280, height: 720 } }) : null;
const browser = persistent?.browser() ?? await chromium.launch(launch);
if (persistent) {
    const settings = await persistent.newPage();
    await settings.goto('chrome://settings/appearance');
    const zoom = settings.locator('settings-appearance-page select').filter({ has: settings.getByRole('option', { name: '125%' }) });
    await zoom.selectOption({ label: '125%' });
    assert.equal((await zoom.locator('option:checked').textContent()).trim(), '125%');
    await settings.close();
}
console.log(JSON.stringify({ run, browser: browser.version(), environment: 'LOCAL_BROWSER', base: process.env.P22_BASE }));
try {
    for (const [width, height] of (nativeZoom ? [[1024, 576]] : process.env.P22_MATRIX === "1" ? [[1920, 1080], [1440, 900], [1280, 720]] : [[1280, 720]])) {
        const session = persistent ?? await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width === 1024 ? 1.25 : 1 });
        await session.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
        const page = await session.newPage();
        page.setDefaultTimeout(20000);
        const errors = [], httpErrors = [], writes = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('response', response => {
            const url = new URL(response.url());
            if (response.status() >= 400)
                httpErrors.push({ path: url.pathname, status: response.status() });
            if (url.pathname === '/draft' && response.request().method() === 'POST')
                writes.push(response.status());
        });
        const calls = [];
        page.on('request', request => {
            const path = new URL(request.url()).pathname;
            if (request.method() === 'POST' && ['/interaction', '/draft'].includes(path))
                calls.push(path);
        });
        let scenario, key;
        const b = (name, scope = page) => scope.getByRole('button', { name, exact: typeof name === 'string' });
        const root = page.locator('[data-composer]');
        const nav = page.locator('[data-workshop-navigation]');
        const search = page.getByRole('textbox', { name: 'Rechercher une intention', exact: true });
        const panel = () => page.locator('[data-restaurant-editor],dialog[open]').filter({ has: nav });
        const read = async (endpoint) => (await page.request.get(origin + '/' + endpoint + '?scenario=' + encodeURIComponent(scenario))).json();
        const digest = () => root.getAttribute('data-digest');
        const save = async (previous) => {
            if (previous)
                await page.waitForFunction(old => document.querySelector('[data-composer]')?.getAttribute('data-digest') !== old, previous.digest, { timeout: 30000 });
            const deadline = Date.now() + 30000;
            let active;
            do {
                await page.locator('[data-draft-status][data-state="SAVED"]').waitFor({ timeout: 30000 });
                active = (await read('draft')).active;
                if (active && active.digest === await digest() && (!previous || active.version > previous.version))
                    break;
                await new Promise(resolve => setTimeout(resolve, 90));
            } while (Date.now() < deadline);
            assert(active, 'Draft absent du stockage C8');
            assert.equal(active.digest, await digest());
            if (previous) {
                assert.equal(active.draftId, previous.draftId);
                assert(active.version > previous.version);
            }
            return active;
        };
        const compare = async (prior) => assert.deepEqual((await read('draft')).active, prior);
        const row = (draft, id) => draft.semanticState.contexts.find(c => c.contextOccurrenceId === id);
        const current = () => page.getByRole('combobox', { name: 'Changer d’intention', exact: true }).inputValue();
        const open = async (id) => {
            await page.getByRole('combobox', { name: 'Retrouver une intention du mois', exact: true }).selectOption(id);
            await nav.waitFor();
            assert.equal(await current(), id);
        };
        const board = async () => {
            if (await nav.isVisible()) {
                if (await b('← Revenir au projet').isVisible())
                    await b('← Revenir au projet').click();
                if (await b('← Mes intentions').isVisible())
                    await b('← Mes intentions').click();
                else if (await b('Retour au mois').isVisible())
                    await b('Retour au mois').click();
                await nav.waitFor({ state: 'hidden' });
            }
        };
        const reload = async (expected) => {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await root.waitFor({ timeout: 30000 });
            await page.locator('[data-draft-status][data-state="SAVED"]').waitFor({ timeout: 30000 });
            assert.equal(await digest(), expected.digest);
            await compare(expected);
        };
        const shot = async (label) => {
            const layout = await page.evaluate(() => {
                const dlg = document.querySelector('dialog[open]') ?? document.querySelector('[data-restaurant-editor]');
                const dock = [...document.querySelectorAll('[data-question-dock]')].find(n => n.getBoundingClientRect().height > 0);
                const p = dlg?.getBoundingClientRect(), d = dock?.closest('[data-palette-dock]')?.getBoundingClientRect();
                const rail = document.querySelector('[data-board-continuous]');
                const bounds = r => r && [r.x, r.y, r.right, r.bottom].map(n => Math.round(n));
                const project = dlg?.querySelector('[data-catalog-context-editor="other-context"],[data-project-editor]');
                return { window: innerWidth, dpr: devicePixelRatio, height: innerHeight, document: document.documentElement.scrollWidth, panel: dlg ? dlg.scrollWidth - dlg.clientWidth : null,
                    panelBounds: bounds(p), dockBounds: bounds(d), railWidth: rail?.clientWidth ?? null,
                    overflowY: dlg ? getComputedStyle(dlg).overflowY : null, panelOverflow: dlg ? dlg.scrollHeight - dlg.clientHeight : null,
                    dockGap: p && d ? Math.round(d.top - p.bottom) : null, isProject: !!project };
            });
            const file = key + '-' + label + '-' + width + '.png';
            await page.screenshot({ path: out + file, animations: 'disabled', timeout: 60000 });
            assert.equal(layout.window, width);
            if (nativeZoom)
                assert.equal(layout.dpr, 1.25);
            assert(layout.document <= width + 1, JSON.stringify(layout));
            assert(layout.panel === null || layout.panel <= 1, JSON.stringify(layout));
            return { file, layout };
        };
        const modal = page.locator('[data-project-starter-preview]');
        const starter = async (name, onlyCinema = false, model = 'Cinéma et restaurant') => {
            await page.locator('summary').filter({ hasText: /^Modèles de projets$/ }).click();
            await b('Prévisualiser ' + model).click();
            await modal.waitFor();
            assert.match(await modal.innerText(), /projet|intention|Achats|Séjour|Sortie/i);
            await modal.getByLabel('Nom du projet', { exact: true }).fill(name);
            if (onlyCinema)
                await modal.getByRole('checkbox', { name: /Restaurant à deux/ }).uncheck();
        };
        const createStarter = async () => {
            await b('Créer ce projet dans le brouillon', modal).click();
            await modal.waitFor({ state: 'hidden', timeout: 30000 });
            return save();
        };
        const setPrice = async (value) => {
            await panel().locator('[data-workshop-component] input[inputmode="decimal"]').first().fill(value);
            await b('Conserver ce poste', panel()).click();
        };
        const test = async (name, fn) => {
            if (process.env.COMPOSER_P22_CASE && !process.env.COMPOSER_P22_CASE.split(',').includes(name))
                return;
            key = name;
            scenario = 'L1_TEST_V22_' + run + '_' + width + '_' + name;
            const errStart = errors.length, httpStart = httpErrors.length;
            const result = { run, width, height, scenario, name, environment: 'LOCAL_BROWSER', checks: [] };
            results.push(result);
            try {
                await page.goto(origin + '/?scenario=' + scenario + '&durable=1', { waitUntil: 'domcontentloaded', timeout: 45000 });
                await root.waitFor({ timeout: 45000 });
                assert.equal((await read('draft')).active, null);
                await fn(result);
                assert.deepEqual(errors.slice(errStart), []);
                assert.deepEqual(httpErrors.slice(httpStart), []);
                const evidence = await read('evidence');
                assert.deepEqual(evidence.counts, { plans: 0, revisions: 0 });
                assert.equal(evidence.remoteWrites, 0);
                result.status = 'PASS';
            }
            catch (e) {
                result.status = 'FAIL';
                result.error = e.stack;
                try {
                    await page.screenshot({ path: out + name + '-failure-' + width + '.png', timeout: 4000 });
                }
                catch { }
                try {
                    await fs.writeFile(out + name + '-failure-' + width + '.txt', await page.locator('body').ariaSnapshot({ timeout: 3000 }));
                }
                catch { }
            }
            result.pageErrors = errors.slice(errStart);
            result.httpErrors = httpErrors.slice(httpStart);
            await fs.writeFile(out + 'results.json', JSON.stringify(results, null, 2));
            console.log(JSON.stringify({ name, width, status: result.status, checks: result.checks, error: result.error?.slice(0, 950) }));
        };
        const hit = async (r, key, locator) => { const start = performance.now(); await locator.click(); r.gestures ??= {}; const e = r.gestures[key] ??= { clicks: 0, elapsedMs: 0 }; e.clicks++; e.elapsedMs += Math.round(performance.now() - start); };
        const field = (name, scope = page) => scope.getByLabel(name, { exact: true });
        const linked = id => page.locator('[data-linked-intention="' + id + '"] button').first();
        const waitLinkedFocus = id => page.waitForFunction(childId =>
            document.activeElement?.closest('[data-linked-intention]')?.getAttribute('data-linked-intention') === childId, id);
        const childOf = (a, id, t) => a.semanticState.contexts.find(c => c.parentContextOccurrenceId === id && c.templateKey === t);
        const click = (r, k, n, scope = page) => hit(r, k, b(n, scope));
        const capture = async (r, label) => { r.checks.push(await shot(label)); };
        const add = async (query, preset) => {
            await search.fill(query);
            await page.locator('[data-library] [data-preset="' + preset + '"]').click();
            await nav.waitFor();
            const id = await current();
            return { id, draft: await save() };
        };
        const article = async (r, label, price) => {
            await click(r, 'Ajouter article', 'Saisir un article');
            await field('Nom de l’article').fill(label);
            await field('Prix par unité (€)').fill(price);
            await click(r, 'Ajouter article', 'Conserver l’article');
            return save();
        };
        const unchanged = async (r, label, prior, action) => {
            await page.waitForTimeout(220);
            const start = calls.length;
            await action();
            await page.waitForTimeout(280);
            await compare(prior);
            assert.equal(await digest(), prior.digest);
            assert.deepEqual(calls.slice(start), []);
            r.quiet ??= [];
            r.quiet.push(label);
        };
        const choice = label => b(label, page.locator('[data-question-dock] [data-palette-options]'));
        const snap = async (r, label) => {
            const options = page.locator('[data-question-dock][data-dock-nature="DECISION"] [data-palette-options] button:visible');
            if (await options.count())
                assert((await options.count()) <= 4);
            const texts = await page.locator('[data-question-dock] button:visible').allTextContents();
            r.docks ??= {};
            r.docks[label] = texts;
            const offers = page.locator('[data-project-completion]');
            if (await offers.isVisible()) {
                await offers.locator('summary').click();
                r.docks[label + ' S3'] = await offers.getByRole('button').allTextContents();
                await offers.locator('summary').click();
            }
        };
        await test('mascara-amazon', async (r) => {
            const m = await add('mascara', 'mascara');
            await snap(r, 'Mascara initial');
            await click(r, 'Prix Mascara', /^Préciser le produit/);
            await panel().locator('input[inputmode="decimal"]').first().fill('12,50');
            let m2;
            {
                await field('Quantité totale').fill('2');
                await click(r, 'Prix Mascara', 'Conserver ce poste', panel());
                m2 = await save(m.draft);
            }
            assert.equal(Number(row(m2, m.id).slotSelections.products.items[0].quantity), 2);
            if (await b('Retour au résumé').isVisible())
                await b('Retour au résumé').click();
            await board();
            await search.fill('Mascara');
            const existing = page.locator('[data-library-existing-action="' + m.id + '"]');
            await hit(r, 'Reprendre occurrence', existing);
            assert.equal(await current(), m.id);
            await compare(m2);
            await board();
            const a = await add('amazon', 'amazon-purchase');
            await b('Ajouter depuis le catalogue', panel()).click();
            const catalog = page.locator('[data-composer-catalog][open]');
            await catalog.getByRole('textbox', { name: 'Rechercher dans tous les éléments' }).fill('Mascara');
            await catalog.locator('[data-catalog-entry="v22-art:excel:190"]').click();
            await b(/^Préparer Mascara/, catalog).click();
            await field('Prix par unité (€)').fill('12');
            await field('Quantité').fill('2');
            await b('Conserver l’article').click();
            await save(a.draft);
            await article(r, 'Câble', '7');
            const a2 = await article(r, 'Câble', '9');
            const items = row(a2, a.id).slotSelections.item.items;
            await snap(r, 'Panier deux lignes');
            const li = page.locator('[data-basket-line="' + items[2].selectionId + '"]');
            assert(!r.docks['Panier deux lignes'].some(t => t.includes("Modifier le vendeur")));
            const choices = r.docks['Panier deux lignes'];
            assert(choices.findIndex(t => t.includes("Choisir la ligne")) < choices.findIndex(t => t.includes("Ajouter un article")));
            await unchanged(r, 'Panier : survol, clavier et homonyme sans écriture', a2, async () => {
                await choice(/^Choisir la ligne/).hover();
                await choice(/^Choisir la ligne/).press('Enter');
                const chosen = page.locator('[data-basket-choice="' + items[2].selectionId + '"]');
                await chosen.press('Enter');
                assert.equal(Number(await field('Prix par unité (€)').inputValue()), 9);
                assert(await field('Prix par unité (€)').evaluate(n => n === document.activeElement));
                await b('Retour au panier').click();
            });
            await capture(r, 'panier');
            {
                await click(r, 'Prix Amazon', /^Modifier le prix/, li);
                assert.equal(await field('Prix par unité (€)').evaluate(e => e === document.activeElement), true);
            }
            {
                await hit(r, 'Vérification focus', li.getByRole('button', { name: /^Modifier la quantité/ }));
                assert(await field('Quantité').evaluate(e => e === document.activeElement));
                await hit(r, 'Vérification focus', li.getByRole('button', { name: /^Modifier le prix/ }));
                assert(await field('Prix par unité (€)').evaluate(e => e === document.activeElement));
            }
            await capture(r, 'prix');
            await field('Prix par unité (€)').fill('9,');
            await page.locator('[data-save-raw]').waitFor();
            await b('Conserver l’article').click();
            await page.getByRole('alert').last().waitFor();
            assert.equal(await field('Prix par unité (€)').inputValue(), '9,');
            assert.equal(await digest(), a2.digest);
            await compare(a2);
            await field('Prix par unité (€)').fill('9,50');
            await click(r, 'Prix Amazon', 'Conserver l’article');
            const a3 = await save(a2);
            assert(await li.getByRole('button', { name: /^Modifier Câble/ }).evaluate(e => e === document.activeElement));
            assert.deepEqual(row(a3, a.id).slotSelections.item.items.slice(0, 2), items.slice(0, 2));
            assert.equal(row(a3, a.id).slotSelections.item.items[2].selectionId, items[2].selectionId);
            {
                await click(r, 'Quantité Amazon', /^Modifier la quantité/, li);
                assert(await field('Quantité').evaluate(e => e === document.activeElement));
            }
            await field('Quantité').fill('2');
            await click(r, 'Quantité Amazon', 'Conserver l’article');
            const final = await save(a3);
            assert.equal(Number(row(final, a.id).slotSelections.item.items[2].quantity), 2);
            {
                await board();
                await b('Annuler la dernière modification du brouillon').click();
                const undone = await save(final);
                assert.equal(undone.digest, a3.digest);
                await b('Rétablir la modification du brouillon').click();
                const redone = await save(undone);
                assert.equal(redone.digest, final.digest);
                r.undoRedo = true;
                await reload(redone);
                await open(a.id);
                assert.equal(await li.count(), 1);
            }
            const loaded = await save();
            assert.equal(loaded.digest, final.digest);
            await b('Livraison et frais', panel()).click();
            await page.getByRole('combobox', { name: 'Modalité', exact: true }).selectOption('DELIVERY');
            await page.getByRole('combobox', { name: 'Frais de livraison', exact: true }).selectOption('ADDITIONAL');
            await field('Frais distincts (€)').fill('5');
            await b('Conserver la livraison', panel()).click();
            const shipped = await save(loaded);
            assert.equal(row(shipped, a.id).fields.merchantLabel, 'Amazon');
            assert.equal(Number(row(shipped, a.id).slotSelections.shipping.items[0].cost.unitAmount), 5);
            await b('← Mes intentions').click();
            await nav.waitFor({ state: 'hidden' });
            await search.fill('');
            const reopen = page.locator('[data-library-recommendation-key="open:' + a.id + '"]');
            await reopen.click();
            await nav.waitFor();
            const ret = b('← Mes intentions', panel());
            await ret.scrollIntoViewIfNeeded();
            r.mouseTarget = await ret.evaluate(el => {
                const bounds = el.getBoundingClientRect();
                const top = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
                return { bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, hitSelf: el === top || el.contains(top),
                    top: top?.tagName, dpr: devicePixelRatio, viewport: [innerWidth, innerHeight] };
            });
            await ret.click();
            await nav.waitFor({ state: 'hidden' });
            await compare(shipped);
            await reload(shipped);
            await open(a.id);
            assert.deepEqual(row(shipped, m.id), row(m2, m.id));
            r.receipt = { basket: a.id, article: items[2].selectionId, mascara: m.id, digest: shipped.digest, version: shipped.version };
        });
        await test('cinema-restaurant', async (r) => {
            await starter('P22-03 · Sortie');
            const initial = await createStarter();
            const id = initial.semanticState.contexts.find(c => c.fields.label === 'P22-03 · Sortie').contextOccurrenceId;
            await search.fill('P22-03');
            await hit(r, 'Reprendre projet', page.locator('[data-library-existing-action="' + id + '"]'));
            assert.equal(await current(), id);
            const cid = childOf(initial, id, 'activity').contextOccurrenceId, rid = childOf(initial, id, 'restaurant').contextOccurrenceId;
            await capture(r, 'parent');
            await snap(r, 'Projet avec restaurant');
            await hit(r, 'Ouvrir enfant', linked(cid));
            assert.equal(await current(), cid);
            await snap(r, 'Cinéma initial');
            const prefs = panel().locator('summary').filter({ hasText: /^Gérer les suggestions$/ });
            await unchanged(r, 'Cinéma : masquage et réaffichage par occurrence', initial, async () => {
                await prefs.click();
                await b(/^Masquer · Billet de cinéma/).press('Enter');
                assert.equal(await choice(/^Billet de cinéma/).count(), 0);
                await b('Réafficher les suggestions masquées').press('Enter');
                assert(await choice(/^Billet de cinéma/).isVisible());
                await prefs.click();
            });
            await choice(/^Billet de cinéma/).press('Enter');
            const price = panel().locator('[data-workshop-component] input[inputmode="decimal"]').first();
            await page.waitForFunction(() => document.activeElement?.matches('[data-workshop-component] input[inputmode=decimal]'));
            await price.fill('12,50');
            await click(r, 'Billet', 'Conserver ce poste', panel());
            const bill = await save(initial);
            await snap(r, 'Cinéma avec billet');
            await click(r, 'Date Cinéma', /^Séance/, panel());
            const cinemaDate = field('Date facultative', panel());
            await page.waitForFunction(() => document.activeElement?.matches('[data-cinema-editor] input[type=date]'));
            await cinemaDate.fill('2026-11-21');
            await click(r, 'Date Cinéma', 'Confirmer la date');
            const dated = await save(bill);
            await choice(/^Popcorn — Préparer/).click();
            await b('Supplément réel', page.locator('[data-workshop-confirmation][open]')).click();
            await panel().locator('[data-workshop-component] input[inputmode="decimal"]').first().fill('4');
            await b('Conserver ce poste', panel()).click();
            const snack = await save(dated);
            assert.equal(row(snack, cid).slotSelections.extras.items.filter(x => x.label === 'Popcorn').length, 1);
            await click(r, 'Retour parent', '← Revenir au projet');
            assert.equal(await current(), id);
            await hit(r, 'Ouvrir Restaurant', linked(rid));
            await click(r, 'Addition', /^Préciser l’addition/);
            await field('Coût prévu à notre charge (€)').fill('40');
            await click(r, 'Addition', 'Conserver ce coût');
            const meal = await save(snack);
            await click(r, 'Supplément', /^Préparer un supplément distinct/);
            if (await b('Supplément réel').isVisible())
                await click(r, 'Supplément', 'Supplément réel');
            await panel().locator('[data-workshop-component] input[inputmode="decimal"]').first().fill('6');
            await click(r, 'Supplément', 'Conserver ce poste', panel());
            const done = await save(meal);
            assert.deepEqual(row(done, cid), row(snack, cid));
            await click(r, 'Revenir du Restaurant', '← Revenir au projet');
            assert.equal(await current(), id);
            await waitLinkedFocus(rid);
            await compare(done);
            await board();
            await b('Annuler la dernière modification du brouillon').click();
            const undo = await save(done);
            await b('Rétablir la modification du brouillon').click();
            const redo = await save(undo);
            assert.equal(redo.digest, done.digest);
            await reload(redo);
            await open(id);
            assert(await linked(cid).count());
            assert(await linked(rid).count());
            r.receipt = { parent: id, cinema: cid, restaurant: rid, digest: redo.digest, version: redo.version };
        });
        await test('weekend-musee', async (r) => {
            await starter('P22-03 · Séjour', false, 'Week-end et musée');
            const initial = await createStarter();
            const id = initial.semanticState.contexts.find(c => c.fields.label === 'P22-03 · Séjour').contextOccurrenceId;
            const child = childOf(initial, id, 'activity');
            await open(id);
            await snap(r, 'Week-end et Musée');
            await click(r, 'Période', /^Préciser la période/);
            await field('Date de départ (facultative)').fill('2026-11-21');
            await field('Date de retour (facultative)').fill('2026-11-23');
            await capture(r, 'periode');
            await click(r, 'Période', 'Conserver et prévisualiser', panel());
            const dates = await save(initial);
            await snap(r, 'Week-end avec période');
            if (!await b(/^Préciser l’hébergement/).isVisible())
                await b('Retour au résumé', panel()).click();
            await click(r, 'Hébergement', /^Préciser l’hébergement/);
            await click(r, 'Hébergement', 'Prix par nuit');
            await panel().locator('[data-workshop-component] input[inputmode="decimal"]').first().fill('100');
            await field('Nombre de nuits (facultatif)').fill('2');
            await click(r, 'Hébergement', 'Conserver et prévisualiser', panel());
            const done = await save(dates);
            if (!await linked(child.contextOccurrenceId).count())
                await b('Retour au résumé', panel()).click();
            await hit(r, 'Musée', linked(child.contextOccurrenceId));
            assert.equal(await current(), child.contextOccurrenceId);
            await click(r, 'Retour séjour', '← Revenir au projet');
            assert.equal(await current(), id);
            await waitLinkedFocus(child.contextOccurrenceId);
            await compare(done);
            assert.equal(row(done, id).fields.endDate, '2026-11-23');
            {
                await click(r, 'Reprendre prix hébergement', /^Modifier le prix de l’hébergement/, panel());
                assert.equal(Number(await panel().locator('[data-workshop-component] input[inputmode="decimal"]').first().inputValue()), 100);
                await compare(done);
            }
            assert.equal(Number(row(done, id).slotSelections.lodging.items[0].cost.unitAmount), 100);
            if (await b('Retour au résumé', panel()).isVisible())
                await b('Retour au résumé', panel()).click();
            const completion = page.locator('[data-project-completion]');
            await unchanged(r, 'Séjour : ouverture et refus local S3', done, async () => {
                await completion.locator('summary').click();
                const hide = b('Masquer Randonnée / Nature', completion);
                await hide.press('Enter');
                assert.equal(await b('Préparer Randonnée / Nature', completion).count(), 0);
                await b('Réafficher les suggestions masquées', completion).press('Enter');
                await b('Préparer Restaurant à deux', completion).press('Enter');
                await page.locator('[data-workshop-confirmation][open]').waitFor();
                assert.equal(await digest(), done.digest);
            });
            await b('Ajouter cette intention', page.locator('[data-workshop-confirmation][open]')).press('Enter');
            const added = await save(done);
            const meal = childOf(added, id, 'restaurant');
            assert(meal);
            await page.waitForFunction(id => document.activeElement?.closest('[data-linked-intention]')?.getAttribute('data-linked-intention') === id, meal.contextOccurrenceId);
            await linked(meal.contextOccurrenceId).press('Enter');
            assert.equal(await current(), meal.contextOccurrenceId);
            await b('← Revenir au projet').click();
            const suggestions = page.locator('[data-project-completion]');
            if (await suggestions.isVisible()) {
                await suggestions.locator('summary').click();
                assert.equal(await b('Préparer Restaurant à deux', suggestions).count(), 0);
            }
            assert.equal(added.semanticState.contexts.filter(c => c.parentContextOccurrenceId === id && c.templateKey === 'restaurant').length, 1);
            assert.deepEqual(row(added, child.contextOccurrenceId), child);
            await compare(added);
            await board();
            await reload(added);
            await open(id);
            assert.equal(row(added, id).fields.endDate, '2026-11-23');
            assert.equal(Number(row(added, id).slotSelections.lodging.items[0].cost.unitAmount), 100);
            r.receipt = { parent: id, museum: child.contextOccurrenceId, restaurant: meal.contextOccurrenceId, digest: added.digest, version: added.version };
            r.adoption = { id: meal.contextOccurrenceId, digest: added.digest, focus: true, duplicate: false };
        });
        const ideas = page.locator('[data-library-recommendations]');
        const items = () => ideas.locator('[data-library-recommendation]');
        const library = page.locator('[data-library]');
        const confirmation = page.locator('[data-workshop-confirmation][open]');
        const exists = () => page.locator('[data-library-existing]');
        const quiet = async (r, label, action) => {
            await page.waitForTimeout(240);
            const before = await digest(), saved = (await read('draft')).active, start = calls.length;
            await action();
            await page.waitForTimeout(280);
            assert.equal(await digest(), before);
            assert.deepEqual((await read('draft')).active, saved);
            assert.deepEqual(calls.slice(start), []);
            r.reads ??= [];
            r.reads.push(label);
        };
        const catalogue = page.locator('[data-composer-catalog][open]');
        const tile = (preset) => library.locator('[data-preset="' + preset + '"]');
        const closeCatalog = () => b('Fermer le catalogue', catalogue).click();
        const detail = (id) => catalogue.locator('[data-catalog-detail="' + id + '"]');
        const discover = async (scope, query, id) => {
            await catalogue.getByRole('combobox', { name: 'Contexte du catalogue' }).selectOption(scope);
            await catalogue.getByRole('textbox', { name: 'Rechercher dans tous les éléments' }).fill(query);
            await catalogue.locator('[data-catalog-entry="' + id + '"]').click();
            await detail(id).waitFor();
        };
        await test('bibliotheque-refus', async (r) => {
            await ideas.waitFor();
            r.general = await items().allTextContents();
            assert.equal(r.general.length, 4);
            await quiet(r, 'Classement, survol, catégories et recherche', async () => {
                await items().first().hover();
                await library.locator('[data-library-group-toggle="ACTIVITY"]').press('Enter');
                r.leisure = await items().allTextContents();
                assert(r.leisure.some(text => text.includes('Bowling')));
                await search.fill('Billet de cinéma');
                assert.equal(await ideas.count(), 0);
                assert(await tile('cinema').isVisible());
                await search.fill('aucun-resultat-recette-p2205');
                assert.equal(await ideas.count(), 0);
                await search.press('Escape');
                await b('Produits pour Courses', library).click();
                await catalogue.waitFor();
                const first = catalogue.locator('[data-catalog-entry]').first();
                await first.waitFor();
                await first.click();
                assert.match(await catalogue.locator('[data-catalog-detail]').innerText(), /Courses et produits alimentaires/);
                await closeCatalog();
            });
            if (!await ideas.getByText('Cinéma', { exact: true }).isVisible())
                await library.locator('[data-library-group-toggle="ACTIVITY"]').click();
            const idea = ideas.locator('[data-library-recommendation-key="preset:cinema"]');
            await quiet(r, 'Préparation d’une carte sans confirmation', async () => {
                await idea.press('Enter');
                await confirmation.waitFor();
            });
            await b('Préparer cette intention', confirmation).press('Enter');
            const a = await save();
            const cid = await current();
            assert.equal(a.semanticState.contexts.find(c => c.contextOccurrenceId === cid)?.fields.composerPresentation?.presetKey, 'cinema');
            await quiet(r, 'Dock et catalogue Cinéma sans mutation', async () => {
                const dock = page.locator('[data-question-dock][data-dock-nature="DECISION"]');
                const props = dock.locator('[data-palette-options] button');
                assert((await props.count()) <= 4);
                assert.match(await props.first().innerText(), /Catalogue V22/);
                assert.match(await props.filter({ hasText: 'Popcorn' }).innerText(), /Complément métier Cinéma/);
                await b(/^Parcourir le catalogue de Cinéma/).press('Enter');
                await catalogue.waitFor();
                await discover('cinema', 'Billet de cinéma', 'v22-art:excel:329');
                assert.match(await detail('v22-art:excel:329').innerText(), /Concept Excel V22/);
                await closeCatalog();
            });
            await board();
            await search.fill('Billet de cinéma');
            await search.press('Enter');
            assert.equal(await current(), cid);
            await compare(a);
            await board();
            await search.fill('Amazon');
            await tile('amazon-purchase').click();
            const basket = await save(a), bid = await current();
            const purchase = () => page.locator('[data-purchase-basket]');
            await purchase().waitFor();
            await quiet(r, 'Mascara proposé dans la commande, sans mutation', async () => {
                await b('Ajouter depuis le catalogue', purchase()).click();
                await catalogue.waitFor();
                await discover('purchase', 'Mascara', 'v22-art:excel:190');
                await b(/^Préparer Mascara/, detail('v22-art:excel:190')).click();
                assert.equal(await purchase().getByLabel('Nom de l’article', { exact: true }).inputValue(), 'Mascara');
            });
            await b('Conserver l’article', purchase()).click();
            const populated = await save(basket);
            const line = populated.semanticState.contexts.find(c => c.contextOccurrenceId === bid).slotSelections.item.items[0];
            assert.equal(line.basketArticle.concept.id, 'v22-art:excel:190');
            assert.equal(line.cost.kind, 'UNKNOWN');
            await board();
            const reopen = ideas.locator('[data-library-recommendation-key="open:' + bid + '"]');
            await search.fill('');
            // Sortie choisie auparavant : fermer son filtre avant de vérifier la reprise générale.
            if (!await reopen.isVisible())
                await library.locator('[data-library-group-toggle="ACTIVITY"]').click();
            await quiet(r, 'Reprise exacte de l’achat et de sa ligne', async () => {
                await reopen.press('Enter');
                assert.equal(await current(), bid);
                await board();
                await b('Tous les éléments', library).click();
                await catalogue.waitFor();
                await discover('all', 'Mascara', 'v22-art:excel:190');
                assert.equal(await b(/^Préparer (un achat|un panier)/, detail('v22-art:excel:190')).count(), 0);
                await b(/^Modifier Mascara · ligne 1/, detail('v22-art:excel:190')).press('Enter');
                assert.equal(await current(), bid);
                assert.equal(await purchase().getByLabel('Nom de l’article', { exact: true }).inputValue(), 'Mascara');
                assert.equal(await purchase().getByLabel('Prix par unité (€)', { exact: true }).inputValue(), '');
                await b('Retour au panier', purchase()).click();
                await board();
            });
            await ideas.locator('[data-library-recommendation-key="open:' + bid + '"]').focus();
            r.checks.push(await shot('bibliotheque-recommandations'));
            r.receipt = { basket: bid, cinema: cid, line: line.selectionId, digest: populated.digest };
        });
        await test('maison-panier', async (r) => {
            await starter('P22-06 · Maison', false, 'Aménager une pièce et préparer ses achats');
            const initial = await createStarter();
            const parent = initial.semanticState.contexts.find(c => c.fields.label === 'P22-06 · Maison');
            assert(parent);
            const basket = childOf(initial, parent.contextOccurrenceId, 'purchase');
            assert(basket);
            await open(parent.contextOccurrenceId);
            await linked(basket.contextOccurrenceId).click();
            assert.equal(await current(), basket.contextOccurrenceId);
            const added = await article(r, 'Lampe synthétique', '18');
            const item = row(added, basket.contextOccurrenceId).slotSelections.item.items[0];
            const li = page.locator('[data-basket-line="' + item.selectionId + '"]');
            await b(/^Modifier le prix/, li).click();
            await field('Prix par unité (€)').fill('21');
            await b('Conserver l’article').click();
            const updated = await save(added);
            await b('← Revenir au projet').click();
            assert.equal(await current(), parent.contextOccurrenceId);
            await waitLinkedFocus(basket.contextOccurrenceId);
            await compare(updated);
            await board();
            await reload(updated);
            await open(parent.contextOccurrenceId);
            await linked(basket.contextOccurrenceId).click();
            assert.equal(await current(), basket.contextOccurrenceId);
            assert.equal(await li.count(), 1);
            assert.equal(row(updated, basket.contextOccurrenceId).slotSelections.item.items[0].selectionId, item.selectionId);
            assert.equal(Number(row(updated, basket.contextOccurrenceId).slotSelections.item.items[0].cost.unitAmount), 21);
            assert.deepEqual(row(updated, parent.contextOccurrenceId).slotSelections.purchases, parent.slotSelections.purchases);
            r.receipt = { parent: parent.contextOccurrenceId, basket: basket.contextOccurrenceId, line: item.selectionId, digest: updated.digest, version: updated.version };
            await capture(r, 'panier');
        });
        await test('aucun-candidat', async (r) => {
            const route = '**/interaction?*';
            await page.route(route, async (handler) => {
                const response = await handler.fetch();
                const body = await response.json();
                if (body.ok && body.model) {
                    body.model.dropCapabilities = [];
                    body.model.board.contexts = body.model.board.contexts.map(card => ({ ...card, readOnly: true, capabilityRefs: [] }));
                }
                await handler.fulfill({ response, json: body });
            });
            await page.reload({ waitUntil: 'domcontentloaded' });
            await root.waitFor();
            const initial = await digest();
            assert.equal(await page.locator('[data-library-recommendations]').count(), 0);
            await search.fill('Billet de cinéma');
            assert.equal(await page.locator('[data-library-recommendation]').count(), 0);
            assert.equal(await page.locator('[data-library] [data-preset="cinema"]').count(), 0);
            assert.equal(await digest(), initial);
            assert.equal((await read('draft')).active, null);
            await capture(r, 'vide');
            r.mutations = 0;
            await page.unroute(route);
        });
        await session.close();
    }
}
finally {
    await browser.close();
}
if (results.some(r => r.status !== 'PASS'))
    process.exitCode = 1;
