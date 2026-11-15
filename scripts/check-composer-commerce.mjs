import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";
import { uuid } from "./fixtures/planner-headless.mjs";

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLANNER_PLAYWRIGHT_MODULE
  ? require(process.env.PLANNER_PLAYWRIGHT_MODULE) : require("playwright-core");
const origin = "http://127.0.0.1:" + (process.env.COMPOSER_C8_TEST_PORT ?? "3210");
const scenario = "COMMERCE";
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(30000);
  const root = page.locator("[data-composer]");
  const library = page.locator("[data-library]");
  const gift = page.locator("[data-gift-editor]");
  const service = page.locator("[data-service-editor]");
  const basket = page.locator("[data-purchase-basket]");
  const button = (scope, name) => scope.getByRole("button", { name, exact: typeof name === "string" });
  const board = id => page.locator(`[data-context="${id}"]`);
  const dock = id => page.locator(`[data-context-palette="${id}"]`);
  const badge = (scope, kind) => scope.locator(`[data-commerce-badge="${kind}"]`);
  const read = async () => (await (await page.request.get(`${origin}/draft?scenario=${scenario}`)).json()).active;
  const card = key => draft.semanticState.contexts.find(item => item.fields.composerPresentation?.presetKey === key);
  let draft;
  const save = async () => {
    const deadline = Date.now() + 30000;
    do {
      if (await root.getAttribute("data-save-state") === "SAVED") {
        const next = await read();
        if (next && next.version > (draft?.version ?? 0) && next.digest === await root.getAttribute("data-digest")) {
          if (draft) assert.equal(next.draftId, draft.draftId);
          draft = next;
          return;
        }
      }
      await sleep(120);
    } while (Date.now() < deadline);
    assert.fail("Sauvegarde serveur sans reçu correspondant");
  };
  const create = async (query, key) => {
    await button(library, "À ajouter").click();
    await library.getByRole("textbox", { name: "Rechercher une intention" }).fill(query);
    await library.locator(`[data-preset="${key}"]`).click();
    await save();
    return card(key).contextOccurrenceId;
  };
  const reopen = async id => {
    const existing = board(id).locator("[data-context-focus]");
    if (await existing.isVisible()) {
      await existing.evaluate(element => {
        const viewport = element.closest("[data-board-scroll]");
        if (!viewport) return;
        const bounds = viewport.getBoundingClientRect(), target = element.getBoundingClientRect();
        viewport.scrollBy({ left: target.left + target.width / 2 - bounds.left - bounds.width / 2 });
        viewport.scrollTop = 0;
      });
      await existing.click();
      return;
    }
    await button(library, "Mes intentions").click();
    await library.getByRole("textbox", { name: "Rechercher une intention" }).fill("");
    await library.locator(`[data-library-existing-action="${id}"]`).click();
  };

  await page.goto(`${origin}/?scenario=${scenario}&durable=1`);
  await root.waitFor();
  const openingDigest = await root.getAttribute("data-digest");
  assert.equal(await badge(board(uuid(8021)), "restaurant").innerText(), "Restaurant · Table de recette");
  assert.equal(await badge(board(uuid(8022)), "bar").innerText(), "Bar · Bar de recette");
  assert.equal(await badge(board(uuid(8023)), "place").innerText(), "Lieu saisi · Table de recette");
  assert.equal(await badge(board(uuid(8023)), "restaurant").count(), 0);
  assert.equal(await badge(board(uuid(8023)), "merchant").count(), 0);
  assert.equal(await root.getAttribute("data-digest"), openingDigest);
  assert.equal(await read(), null);

  const serviceId = await create("Coiffeur", "hairdresser-service");
  await service.waitFor();
  await button(service, "Coupe").click();
  await service.getByLabel("Prestataire (facultatif)").fill("Alex de recette");
  await button(service, "Voir tous les lieux compatibles, y compris les lieux rares").click();
  await service.getByRole("combobox", { name: "Établissement" }).selectOption("f2000000-0000-4000-8000-000000000001");
  await service.getByLabel("Date envisagée").fill("2026-11-19");
  await service.getByLabel("Heure envisagée").fill("16:30");
  await service.getByLabel("Rendez-vous envisagé").check();
  await service.getByLabel("Tarif prévu (€)").fill("24");
  await button(service, "Conserver la prestation").click();
  await save();
  const hairdresser = card("hairdresser-service");
  const originalLine = hairdresser.slotSelections.main.items[0];
  assert.equal(hairdresser.fields.appointmentIntent, "CONSIDERING");
  assert.equal(hairdresser.fields.plannedTime, "16:30");
  assert.equal(hairdresser.fields.providerLabel, "Alex de recette");
  assert.deepEqual(hairdresser.fields.placeRef, { kind: "KNOWN", placeId: "f2000000-0000-4000-8000-000000000001" });
  assert.match(await badge(service, "salon").innerText(), /Salon de recette/u);
  assert.match(await badge(service, "merchant").innerText(), /Atelier de recette/u);
  await button(service, "Fermer la prestation").click();
  await reopen(serviceId);
  assert.equal(await service.getByLabel("Prestation", { exact: true }).inputValue(), "Coupe");
  await service.getByLabel("Tarif prévu (€)").fill("26");
  await button(service, "Conserver la prestation").click();
  await save();
  assert.equal(card("hairdresser-service").slotSelections.main.items[0].selectionId, originalLine.selectionId);
  await button(service, "Fermer la prestation").click();

  const giftId = await create("Cadeau", "gift-present");
  await gift.waitFor();
  await button(dock(giftId), "Destinataire").click();
  await button(dock(giftId), "Autre personne").click();
  await gift.getByPlaceholder("Nom libre").fill("Camille Recette");
  await button(gift, "Retour au résumé").click();
  await button(dock(giftId), "Occasion").click();
  await gift.getByLabel("Occasion choisie").fill("Anniversaire");
  await button(gift, "Retour au résumé").click();
  await button(dock(giftId), "Objet").click();
  await gift.getByLabel("Quel objet ou produit ?").fill("Livre de recette");
  await button(gift, "Retour au résumé").click();
  await button(gift, "Vendeur et établissement").click();
  await gift.getByLabel("Vendeur (facultatif)").fill("Amazon");
  await button(gift, "Conserver et prévisualiser").click();
  await save();
  assert.deepEqual(card("gift-present").fields.recipientRef, { kind: "TEXT", label: "Camille Recette" });
  assert.equal(card("gift-present").fields.merchantLabel, "Amazon");
  assert.equal(await badge(gift, "platform").count(), 0);
  assert.equal(await badge(gift, "seller").innerText(), "Vendeur déclaré · Amazon");
  await button(gift, "Préciser le prix").click();
  await gift.getByLabel("Prix unitaire prévu (€)").fill("30");
  await gift.locator("[data-workshop-component] footer button").click();
  await save();
  const giftState = card("gift-present"), giftLine = giftState.slotSelections.item.items[0];
  assert.deepEqual(giftLine.fundingAllocations ?? [], []);
  assert.equal(giftState.fields.payerRef, undefined);
  await button(gift, "Retour au mois").click();

  const amazonId = await create("Amazon", "amazon-purchase");
  await basket.waitFor();
  await button(basket, "Nom, vendeur et date").click();
  await basket.getByLabel("Vendeur", { exact: true }).fill("Librairie de recette");
  await button(basket, "Conserver les détails").click();
  await save();
  assert.equal(await badge(basket, "platform").innerText(), "Plateforme · Amazon");
  assert.equal(await badge(basket, "seller").innerText(), "Vendeur déclaré · Librairie de recette");
  const final = draft;
  await page.reload();
  await page.locator('[data-composer][data-save-state="SAVED"]').waitFor();
  assert.equal(await root.getAttribute("data-digest"), final.digest);
  assert.deepEqual(await read(), final);
  await reopen(serviceId);
  assert.equal(await service.getByLabel("Tarif prévu (€)").inputValue(), "26");
  assert.equal(await service.getByLabel("Rendez-vous envisagé").isChecked(), true);
  await button(service, "Fermer la prestation").click();
  await reopen(giftId);
  assert.match(await gift.locator("[data-gift-summary]").innerText(), /Camille Recette/u);
  await button(gift, "Vendeur et établissement").click();
  assert.equal(await gift.getByLabel("Vendeur (facultatif)").inputValue(), "Amazon");
  assert.equal(card("gift-present").slotSelections.item.items[0].selectionId, giftLine.selectionId);
  assert.equal(card("amazon-purchase").contextOccurrenceId, amazonId);
  assert.deepEqual(await read(), final);
  const response = await page.request.post(`${origin}/interaction?scenario=${scenario}`, {
    data: { kind: "READ", sequence: 9000, targetMonth: final.semanticState.targetMonth, draft: final.semanticState },
  });
  const compiled = await response.json();
  assert(compiled.ok, compiled.code);
  const totals = compiled.model.budgetReading.byContext;
  assert.equal(totals[serviceId].gross, "26.00");
  assert.equal(totals[giftId].gross, "30.00");
  assert.equal(totals[amazonId].gross, null);
  assert.deepEqual(errors, []);
  console.log("M08/M09 : Save/Reload exact · prestation et cadeau sans doublon · badges Amazon, Restaurant, Bar et lieu ambigu");
} finally {
  await browser.close();
}
