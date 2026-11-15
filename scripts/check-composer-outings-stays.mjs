import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = process.env.PLANNER_PLAYWRIGHT_MODULE
  ? require(process.env.PLANNER_PLAYWRIGHT_MODULE) : require("playwright-core");
const origin = "http://127.0.0.1:" + (process.env.COMPOSER_C8_TEST_PORT ?? "3204");
const scenario = "M06_M07_" + Date.now();
const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.setDefaultTimeout(18000);
  const root = page.locator("[data-composer]");
  const guided = page.locator("[data-restaurant-editor]");
  const stay = page.locator("[data-short-stay-editor]");
  const row = guided.locator("[data-workshop-component]");
  const button = (scope, name) => scope.getByRole("button", { name, exact: typeof name === "string" });
  const read = async () => (await (await page.request.get(`${origin}/draft?scenario=${scenario}`)).json()).active;
  const contextById = (snapshot, id) => snapshot.semanticState.contexts.find(item => item.contextOccurrenceId === id);
  const childOf = (snapshot, parent, preset) => snapshot.semanticState.contexts.find(item =>
    item.parentContextOccurrenceId === parent && item.fields.composerPresentation?.presetKey === preset);
  const component = (snapshot, id, slot) => contextById(snapshot, id).slotSelections[slot].items[0];
  const linked = id => page.locator(`[data-linked-intention="${id}"] > button`);
  const board = id => page.locator(`[data-context="${id}"] [data-context-focus]`);
  const dock = id => page.locator(`[data-context-palette="${id}"]`);
  let draft;
  const commit = async () => {
    const deadline = Date.now() + 18000;
    do {
      if (await root.getAttribute("data-save-state") === "SAVED") {
        const next = await read();
        if (next && next.version > (draft?.version ?? 0) && next.digest === await root.getAttribute("data-digest")) {
          if (draft) assert.equal(next.draftId, draft.draftId);
          draft = next;
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    } while (Date.now() < deadline);
    assert.fail(`Aucun accusé de sauvegarde correspondant à la version après ${draft?.version ?? 0}`);
  };
  const launch = async (model, name) => {
    await page.locator('[data-composer]:is([data-preview-state="FRESH"],[data-preview-state="BLOCKED"])').waitFor();
    const models = page.locator("summary").filter({ hasText: /^Modèles de projets$/u });
    if (await models.evaluate(node => !node.parentElement.open)) await models.click();
    await button(page, "Prévisualiser " + model).click();
    await page.getByRole("textbox", { name: "Nom du projet" }).fill(name);
    await button(page, "Créer ce projet dans le brouillon").click();
    await page.waitForFunction(() => {
      const preview = document.querySelector("[data-project-starter-preview]");
      return !preview || preview.querySelector("[role=alert]")?.textContent?.trim();
    });
    const rejected = page.locator("[data-project-starter-preview] [role=alert]");
    if (await rejected.count()) throw new Error(await rejected.first().innerText());
    await commit();
    const project = draft.semanticState.contexts.find(item => item.fields.label === name);
    await board(project.contextOccurrenceId).click();
    return project.contextOccurrenceId;
  };
  const schedule = async (field, day, time) => {
    await guided.locator('[data-guided-step="date"]').click();
    await guided.getByLabel("Date facultative", { exact: true }).fill(day);
    await guided.getByLabel(field, { exact: true }).fill(time);
    await button(guided, "Conserver le jour et l’heure").click();
    await commit();
  };
  const returnToProject = () => button(page, "← Revenir au projet").click();

  await page.goto(`${origin}/?scenario=${scenario}&durable=1`);
  await root.waitFor();
  const outing = await launch("Cinéma et restaurant", "Sortie M06");
  const cinema = childOf(draft, outing, "cinema").contextOccurrenceId;
  const dinner = childOf(draft, outing, "restaurant-for-two").contextOccurrenceId;
  const outingLinks = structuredClone(contextById(draft, outing).slotSelections);
  await linked(cinema).click();
  await schedule("Heure de la séance", "2026-11-13", "18:30");
  await button(guided, "Suivant").click();
  await guided.locator('[data-guided-step="participants"]').click();
  await guided.getByRole("combobox", { name: "Ajouter une personne" }).selectOption({ label: "Alice Fixture · foyer" });
  await button(guided, "Ajouter aux participants").click();
  await commit();
  assert.equal(contextById(draft, cinema).fields.participantRefs[0].kind, "HOUSEHOLD_PERSON");
  await guided.locator('[data-guided-step="budget"]').click();
  await button(dock(cinema), /^Quantité · /u).click();
  await button(dock(cinema), "Par personne").click();
  await row.getByRole("spinbutton", { name: "Personnes explicitement tarifées" }).fill("2");
  await button(dock(cinema), "Retour au prix").click();
  await row.getByLabel("Tarif par billet (€)", { exact: true }).fill("10");
  await button(row, "Conserver ce poste").click();
  await commit();
  const ticket = component(draft, cinema, "main");
  assert.equal(ticket.unitBasis, "PERSON");
  assert.equal(ticket.pricedParticipantCount, 2);
  await guided.locator('[data-guided-step="budget"]').click();
  await row.getByLabel("Tarif par billet (€)", { exact: true }).fill("12");
  await button(row, "Conserver ce poste").click();
  await commit();
  assert.equal(component(draft, cinema, "main").selectionId, ticket.selectionId);
  await returnToProject();

  await linked(dinner).click();
  await schedule("Heure du repas", "2026-11-13", "20:30");
  await guided.locator('[data-guided-step="budget"]').click();
  await guided.getByLabel("Coût prévu à notre charge (€)").fill("45");
  await button(guided, "Conserver ce coût").click();
  await commit();
  await button(guided, "Suivant").click();
  await guided.locator('[data-guided-step="complete"]').click();
  await button(guided, "Ajouter un détail déjà inclus").click();
  await guided.getByLabel("Nature du détail").fill("Boisson incluse");
  await guided.getByLabel("Montant de la ligne compris (€)").fill("8");
  await button(guided, "Conserver ce détail inclus").click();
  await commit();
  assert.deepEqual(contextById(draft, outing).slotSelections, outingLinks);
  await returnToProject();
  await button(page.locator("[data-project-editor]"), "Retour au mois").click();

  const weekend = await launch("Week-end et musée", "Séjour M07");
  const museum = childOf(draft, weekend, "museum-exhibition").contextOccurrenceId;
  await button(stay, /^Période ·/u).click();
  await stay.getByLabel("Date de départ (facultative)", { exact: true }).fill("2026-11-20");
  await stay.getByLabel("Date de retour (facultative)", { exact: true }).fill("2026-11-22");
  await stay.getByRole("spinbutton", { name: "Nombre de nuits (facultatif)" }).fill("2");
  await button(stay, "Conserver et prévisualiser").click();
  await commit();
  await button(stay, "Participants").click();
  await button(stay, "Ajouter une personne").click();
  await stay.getByRole("combobox", { name: "Personne 1" }).selectOption({ label: "Alice Fixture · foyer" });
  await button(stay, "Conserver et prévisualiser").click();
  await commit();
  await button(stay, "Composer le séjour").click();
  await stay.getByRole("combobox", { name: "Réservation de l’hébergement" }).selectOption("CONSIDERING");
  await button(stay, "Conserver et prévisualiser").click();
  await commit();
  assert.equal(contextById(draft, weekend).fields.lodgingReservation, "CONSIDERING");
  assert.equal(contextById(draft, weekend).slotSelections.lodging, undefined);
  await button(stay, "Composer le séjour").click();
  await stay.getByRole("combobox", { name: "Réservation de l’hébergement" }).selectOption("USER_DECLARED");
  await button(dock(weekend), "Type d’hébergement").click();
  await button(dock(weekend), "Location / gîte").click();
  await button(dock(weekend), /^Prix par nuit/u).click();
  await stay.getByLabel("Tarif par nuit (€)", { exact: true }).fill("70");
  await button(stay, "Conserver et prévisualiser").click();
  await commit();
  const hosted = contextById(draft, weekend);
  const lodging = component(draft, weekend, "lodging");
  assert.equal(hosted.fields.lodgingReservation, "USER_DECLARED");
  assert.equal(hosted.fields.lodgingKind, "RENTAL");
  assert.equal(hosted.fields.nightCount, 2);
  assert.deepEqual(lodging.lodgingPricing, { version: "lodging-pricing@v1", basis: "PER_NIGHT", nightCount: 2 });
  await button(stay, "Composer le séjour").click();
  await button(dock(weekend), "Extras du séjour").click();
  await button(stay, "Ajouter · Extras du séjour").click();
  const fee = stay.locator("[data-workshop-component]");
  await button(dock(weekend), "Nom du poste").click();
  await fee.getByLabel("Nom du poste", { exact: true }).fill("Ménage distinct");
  await button(dock(weekend), "Retour au prix").click();
  await fee.getByLabel("Prix unitaire prévu (€)", { exact: true }).fill("8");
  await button(stay, "Conserver et prévisualiser").click();
  await commit();
  assert.equal(component(draft, weekend, "lodging").selectionId, lodging.selectionId);

  const suggestions = stay.locator("[data-project-completion]");
  await suggestions.locator("summary").click();
  await button(suggestions, "Préparer Restaurant à deux").click();
  assert.deepEqual(await read(), draft);
  await button(page.locator("[data-workshop-confirmation]"), "Ajouter cette intention").click();
  await commit();
  const stayDinner = childOf(draft, weekend, "restaurant-for-two").contextOccurrenceId;
  const stayLinks = structuredClone(contextById(draft, weekend).slotSelections);
  await linked(museum).click();
  await guided.locator('[data-guided-step="budget"]').click();
  await row.getByLabel("Tarif par entrée (€)", { exact: true }).fill("15");
  await button(row, "Conserver ce poste").click();
  await commit();
  await returnToProject();
  await linked(stayDinner).waitFor();
  assert.deepEqual(contextById(draft, weekend).slotSelections, stayLinks);
  assert.equal(await button(suggestions, "Préparer Restaurant à deux").count(), 0);

  await page.reload();
  await page.locator('[data-composer][data-save-state="SAVED"]').waitFor();
  assert.deepEqual(await read(), draft);
  assert.equal(await root.getAttribute("data-digest"), draft.digest);
  await board(weekend).click();
  await linked(museum).waitFor();
  await linked(stayDinner).waitFor();
  assert.match(await stay.locator("[data-stay-details]").innerText(), /Déclarée comme effectuée/u);
  await button(stay, "Retour au mois").click();
  await board(outing).click();
  await linked(cinema).click();
  assert.match(await guided.locator('[data-guided-step="date"]').innerText(), /18:30/u);
  await guided.locator('[data-guided-step="budget"]').click();
  assert.equal(Number(await row.getByLabel("Tarif par billet (€)", { exact: true }).inputValue()), 12);
  const res = await page.request.post(`${origin}/interaction?scenario=${scenario}`, {
    data: { kind: "READ", sequence: 9000, targetMonth: draft.semanticState.targetMonth, draft: draft.semanticState },
  });
  const compiled = await res.json();
  assert.equal(compiled.ok, true, compiled.code);
  const amounts = compiled.model.budgetReading.byContext;
  assert.equal(amounts[outing].knownSubtotal, null);
  assert.equal(amounts[cinema].gross, "24.00");
  assert.equal(amounts[dinner].gross, "45.00");
  assert.equal(amounts[weekend].gross, "148.00");
  assert.equal(amounts[museum].gross, "15.00");
  assert.equal(amounts[stayDinner].gross, null);
  assert.equal(draft.baseRevisionNumber, 0);
  assert.deepEqual(errors, []);
  console.log(`M06/M07 Save/Reload (${draft.version}) · séance et repas · billets ×2 · addition 45 € sans double comptage · 2 nuits à 70 € · liens Musée et Restaurant intacts`);
} finally {
  await browser.close();
}
