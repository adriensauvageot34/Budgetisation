import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLANNER_PLAYWRIGHT_MODULE
  ? require(process.env.PLANNER_PLAYWRIGHT_MODULE) : require("playwright-core");
const origin = "http://127.0.0.1:" + (process.env.COMPOSER_C8_TEST_PORT ?? "3164");
const scenario = "M04_" + Date.now();
const url = `${origin}/?scenario=${scenario}&durable=1`;
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(30000);
  const button = name => page.getByRole("button", { name, exact: typeof name === "string" });
  const root = page.locator("[data-composer]");
  const panel = page.getByRole("region", { name: "Équipements du projet" });
  const label = panel.getByRole("textbox", { name: "Nom de l’équipement" });
  const read = async () => (await (await page.request.get(`${origin}/draft?scenario=${scenario}`)).json()).active;
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
  const findProject = draft => draft.semanticState.contexts.find(item => item.fields.label === "Maison M04");
  const findBasket = draft => draft.semanticState.contexts.find(item =>
    item.parentContextOccurrenceId === findProject(draft).contextOccurrenceId && item.templateKey === "purchase");

  await page.goto(url);
  await root.waitFor();
  await page.locator("summary").filter({ hasText: /^Modèles de projets$/u }).click();
  await button("Prévisualiser Aménager une pièce et préparer ses achats").click();
  await page.getByRole("textbox", { name: "Nom du projet" }).fill("Maison M04");
  await button("Créer ce projet dans le brouillon").click();
  const start = await save();
  const project = findProject(start);
  const basket = findBasket(start);
  assert(project && basket);
  assert.equal(basket.fields.fieldSchemaVersion, "context-fields@v7");
  const openProject = () => page.locator(`[data-context="${project.contextOccurrenceId}"] [data-context-focus]`).click();
  await openProject();
  await panel.waitFor();

  await panel.getByRole("button", { name: "Lampe", exact: true }).click();
  await panel.getByRole("button", { name: "Marquer comme déjà possédé" }).click();
  const owned = await save(start);
  assert.equal(await panel.getByRole("button", { name: "Lampe", exact: true }).count(), 0);
  assert.equal(findProject(owned).fields.homeEquipment.items[0].status, "OWNED");
  assert.deepEqual(findBasket(owned).slotSelections, basket.slotSelections);

  await label.fill("Étagère");
  await button("Noter le besoin").click();
  const needed = await save(owned);
  assert.equal(await panel.locator('[data-home-equipment-state="NEEDED"]').count(), 1);
  assert.deepEqual(findBasket(needed).slotSelections, basket.slotSelections);
  await button("Ajouter Étagère au panier").click();
  const bought = await save(needed);
  const line = findBasket(bought).slotSelections.item.items[0];
  assert.equal(line.selectionId, findProject(needed).fields.homeEquipment.items[1].id);
  assert.equal(line.cost.kind, "UNKNOWN");
  assert.equal(await button("Ajouter Étagère au panier").count(), 0);

  await button("Reprendre Étagère").click();
  const form = page.locator("[data-purchase-basket] form");
  await form.getByRole("textbox", { name: "Quantité" }).fill("3");
  await form.getByRole("button", { name: "Conserver l’article" }).click();
  const edited = await save(bought);
  const lines = findBasket(edited).slotSelections.item.items;
  assert.equal(lines.length, 1);
  assert.equal(lines[0].selectionId, line.selectionId);
  assert.equal(lines[0].quantity, "3");
  assert.equal(lines[0].cost.kind, "UNKNOWN");
  assert.deepEqual(findProject(edited).slotSelections, project.slotSelections);
  assert.deepEqual(findProject(edited).fields.homeEquipment.items, findProject(needed).fields.homeEquipment.items);
  assert.equal(edited.baseRevisionNumber, 0);
  await button("← Revenir au projet").click();
  await panel.waitFor();
  assert.match(await panel.locator('[data-home-equipment-state="IN_BASKET"]').innerText(), /Étagère · Quantité 3/u);

  await page.reload();
  await page.locator('[data-composer][data-save-state="SAVED"]').waitFor();
  assert.equal(await root.getAttribute("data-digest"), edited.digest);
  assert.deepEqual(await read(), edited);
  await openProject();
  await panel.waitFor();
  assert.match(await panel.locator('[data-home-equipment-state="OWNED"]').innerText(), /Lampe/u);
  await button("Reprendre Étagère").click();
  assert.equal(await form.getByRole("textbox", { name: "Quantité" }).inputValue(), "3");
  assert.equal(await form.getByPlaceholder("Prix à préciser").inputValue(), "");
  assert.deepEqual(await read(), edited);
  const response = await page.request.post(`${origin}/interaction?scenario=${scenario}`, {
    data: { kind: "READ", sequence: 9000, targetMonth: edited.semanticState.targetMonth, draft: edited.semanticState },
  });
  const compiled = await response.json();
  assert.equal(compiled.ok, true, compiled.code);
  const projectCard = compiled.model.board.contexts.find(card => card.contextOccurrenceId === project.contextOccurrenceId);
  assert.ok(projectCard.sockets.every(socket => socket.currentItems.every(item => item.kind !== "COMPONENT")));
  assert.equal(compiled.model.budgetReading.byContext[basket.contextOccurrenceId].gross, null);
  assert.deepEqual(errors, []);
  console.log(`M04 Save/Reload : ${edited.version}, ${edited.digest} · Lampe possédée · Étagère ×3 · une seule ligne`);
} finally {
  await browser.close();
}
