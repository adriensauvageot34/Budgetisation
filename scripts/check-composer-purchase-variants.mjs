import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLANNER_PLAYWRIGHT_MODULE
  ? require(process.env.PLANNER_PLAYWRIGHT_MODULE) : require("playwright-core");
const origin = "http://127.0.0.1:" + (process.env.COMPOSER_C8_TEST_PORT ?? "3198");
const scenario = "M05_" + Date.now();
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(20000);
  const root = page.locator("[data-composer]");
  const panel = page.locator("[data-purchase-basket]");
  const form = panel.locator("form");
  const button = (where, name) => where.getByRole("button", { name, exact: true });
  const deliveryChoice = name => form.getByRole("combobox", { name, exact: true });
  const read = async () => (await (await page.request.get(`${origin}/draft?scenario=${scenario}`)).json()).active;
  const occurrence = (draft, id) => draft.semanticState.contexts.find(item => item.contextOccurrenceId === id);
  const lines = (draft, id) => occurrence(draft, id).slotSelections.item.items;
  const save = async previous => {
    if (previous) await page.waitForFunction(digest => document.querySelector("[data-composer]")?.getAttribute("data-digest") !== digest, previous.digest);
    await page.locator('[data-composer][data-save-state="SAVED"]').waitFor();
    const active = await read();
    assert(active);
    assert.equal(active.digest, await root.getAttribute("data-digest"));
    if (previous) {
      assert.equal(active.draftId, previous.draftId);
      assert(active.version > previous.version);
    }
    return active;
  };
  let draft;
  const commit = async () => { draft = await save(draft); };
  const closeBasket = async () => {
    await button(panel, "Fermer le panier").click();
    await panel.waitFor({ state: "hidden" });
  };
  const createBasket = async (keyword, preset) => {
    await page.getByRole("textbox", { name: "Rechercher une intention" }).fill(keyword);
    await page.locator(`[data-library] [data-preset="${preset}"]`).click();
    await panel.waitFor();
    await commit();
    const basket = draft.semanticState.contexts.find(item => item.fields.composerPresentation?.presetKey === preset);
    assert.equal(basket.fields.fieldSchemaVersion, "context-fields@v7");
    return basket.contextOccurrenceId;
  };
  const writeArticle = async fields => {
    for (const [label, value] of Object.entries(fields)) await form.getByLabel(label, { exact: true }).fill(value);
    await button(form, "Conserver l’article").click();
    await commit();
  };
  const article = async fields => {
    await button(panel, "Saisir un article").click();
    await writeArticle(fields);
  };
  const seller = async label => {
    await button(panel, "Nom, vendeur et date").click();
    await form.getByLabel("Vendeur", { exact: true }).fill(label);
    await button(form, "Conserver les détails").click();
    await commit();
  };
  const delivery = async (coverage, amount) => {
    await button(panel, "Livraison et frais").click();
    await deliveryChoice("Modalité").selectOption("DELIVERY");
    await deliveryChoice("Frais de livraison").selectOption(coverage);
    if (amount !== undefined) await form.getByLabel("Frais distincts (€)", { exact: true }).fill(amount);
    await button(form, "Conserver la livraison").click();
    await commit();
  };
  const catalog = async (query, visualConceptId) => {
    await button(panel, "Ajouter depuis le catalogue").click();
    const dialog = page.locator("[data-composer-catalog]");
    await dialog.getByLabel("Rechercher dans tous les éléments").fill(query);
    await dialog.locator(`[data-catalog-entry="${visualConceptId}"]`).click();
    return dialog.locator("[data-catalog-detail]");
  };

  await page.goto(`${origin}/?scenario=${scenario}&durable=1`);
  await root.waitFor();
  const beauty = await createBasket("Acheter un produit de beauté", "beauty-purchase");
  const mascara = await catalog("Mascara", "v22-art:excel:190");
  await button(mascara, "Préparer Mascara dans ce panier").click();
  await writeArticle({ "Teinte ou couleur": "Noir", "Format ou modèle": "8 ml", Quantité: "2" });
  await seller("Beauté Fixture");
  await delivery("INCLUDED");
  const mascaraLine = lines(draft, beauty)[0];
  assert.deepEqual(mascaraLine.basketArticle.variant, { color: "Noir", model: "8 ml" });
  assert.equal(mascaraLine.basketArticle.concept.id, "v22-art:excel:190");
  assert.equal(mascaraLine.cost.kind, "UNKNOWN");
  assert.deepEqual(occurrence(draft, beauty).slotSelections.shipping.items, []);
  await closeBasket();

  const clothing = await createBasket("Acheter des vêtements", "clothing-shopping");
  await article({ "Nom de l’article": "T-shirt", Taille: "M", Couleur: "Bleu", "Prix par unité (€)": "12" });
  await seller("Atelier Fixture");
  const shirt = lines(draft, clothing)[0];
  assert.deepEqual(shirt.basketArticle.variant, { size: "M", color: "Bleu" });
  assert.equal(shirt.basketArticle.concept, undefined);
  assert.equal(occurrence(draft, clothing).fields.deliveryCoverage ?? "UNKNOWN", "UNKNOWN");
  await closeBasket();

  const amazon = await createBasket("Amazon", "amazon-purchase");
  await article({ "Nom de l’article": "Souris", Modèle: "Filaire", "Prix par unité (€)": "10" });
  await article({ "Nom de l’article": "Souris", Modèle: "Sans fil", "Prix par unité (€)": "4" });
  const originalLines = structuredClone(lines(draft, amazon));
  const [first, second] = originalLines;
  assert.notEqual(first.selectionId, second.selectionId);
  const mouse = await catalog("Souris", "v22-art:excel:300");
  assert.equal(await mouse.getByRole("button", { name: /^Préparer Souris/u }).count(), 0);
  await button(mouse, "Modifier Souris · Sans fil · ligne 2").click();
  assert.equal(await form.getByLabel("Modèle", { exact: true }).inputValue(), "Sans fil");
  await button(form, "Retour au panier").click();
  await article({ "Nom de l’article": "Souris", Modèle: "À retirer" });
  const temporary = lines(draft, amazon).at(-1);
  await panel.locator(`[data-basket-line="${temporary.selectionId}"]`).getByRole("button", { name: /^Retirer/u }).click();
  await button(page, "Retirer l’article").click();
  await commit();
  assert.deepEqual(lines(draft, amazon), originalLines);
  await closeBasket();

  const board = id => page.locator(`[data-context="${id}"]`);
  const reopenAmazonLine = async () => {
    const card = board(amazon);
    const summary = card.locator("summary").filter({ hasText: /^Articles du panier$/u });
    if (await summary.evaluate(node => !node.parentElement.open)) await summary.click();
    await card.locator(`[data-board-basket-line="${second.selectionId}"]`).click();
    await form.getByLabel("Modèle", { exact: true }).waitFor();
    assert.equal(await form.getByLabel("Modèle", { exact: true }).inputValue(), "Sans fil");
  };
  await reopenAmazonLine();
  await writeArticle({ Quantité: "3" });
  assert.deepEqual(lines(draft, amazon)[0], first);
  assert.deepEqual(lines(draft, amazon)[1], { ...second, quantity: "3" });
  await delivery("ADDITIONAL", "");
  const unknownFee = occurrence(draft, amazon).slotSelections.shipping.items[0];
  assert.equal(unknownFee.cost.kind, "UNKNOWN");
  await delivery("ADDITIONAL", "2,50");
  const savedFee = occurrence(draft, amazon).slotSelections.shipping.items[0];
  assert.equal(savedFee.selectionId, unknownFee.selectionId);
  assert.equal(Number(savedFee.cost.unitAmount), 2.5);
  assert.equal(occurrence(draft, amazon).fields.merchantLabel, "Amazon");
  assert.equal(occurrence(draft, clothing).fields.merchantLabel, "Atelier Fixture");
  assert.equal(occurrence(draft, beauty).fields.merchantLabel, "Beauté Fixture");
  assert.deepEqual(lines(draft, beauty), [mascaraLine]);
  assert.deepEqual(lines(draft, clothing), [shirt]);
  assert.equal(draft.baseRevisionNumber, 0);

  const saved = draft;
  await page.reload();
  await page.locator('[data-composer][data-save-state="SAVED"]').waitFor();
  assert.deepEqual(await read(), saved);
  assert.equal(await root.getAttribute("data-digest"), saved.digest);
  await reopenAmazonLine();
  assert.equal(await form.getByLabel("Quantité", { exact: true }).inputValue(), "3");
  await button(form, "Retour au panier").click();
  await button(panel, "Livraison et frais").click();
  assert.equal(await deliveryChoice("Frais de livraison").inputValue(), "ADDITIONAL");
  assert.equal(Number((await form.getByLabel("Frais distincts (€)", { exact: true }).inputValue()).replace(",", ".")), 2.5);
  const response = await page.request.post(`${origin}/interaction?scenario=${scenario}`, {
    data: { kind: "READ", sequence: 9000, targetMonth: saved.semanticState.targetMonth, draft: saved.semanticState },
  });
  const compiled = await response.json();
  assert.equal(compiled.ok, true, compiled.code);
  const summary = compiled.model.board.contexts.find(card => card.contextOccurrenceId === amazon).purchaseSummary;
  assert.deepEqual(summary, { articleCount: 2, knownAmount: "24.50", complete: true });
  assert.deepEqual(errors, []);
  console.log(`M05 Save/Reload (${saved.version}) · variantes et vendeurs identiques · deux lignes exactes · livraison comptée une fois`);
} finally {
  await browser.close();
}
