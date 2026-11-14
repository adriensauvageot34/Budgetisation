import assert from "node:assert/strict";
import path from "node:path";
import Module, { createRequire } from "node:module";
import { require } from "./lib/phase2-ts-loader.mjs";
import { readMonthFixture } from "./fixtures/composer-v22-b1.mjs";
import { uuid, householdId } from "./fixtures/planner-headless.mjs";

const testRequire = process.env.PLANNER_REACT_TEST_TOOLS
  ? createRequire(path.resolve(process.env.PLANNER_REACT_TEST_TOOLS, "package.json")) : require;
const React = testRequire("react"), jsx = testRequire("react/jsx-runtime");
const { create, act } = testRequire("react-test-renderer");
const originalLoad = Module._load;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.document = { body: {} };
let remote = 0, confirmation;
globalThis.fetch = async () => { remote++; throw Error("RESTAURANT_SUGGESTIONS_REMOTE_FORBIDDEN"); };
Module._load = function (name, parent, ...args) {
  if (name === "react") return React;
  if (name === "react/jsx-runtime") return jsx;
  if (name === "react-dom") return { createPortal: children => children };
  if (name === "./workshop-confirmation") return { useWorkshopConfirmation: () => value => { confirmation = value; } };
  if (name === "./context-palette" && parent?.filename.endsWith("restaurant-editor.tsx"))
    return { ContextPalette: ({ question }) => React.createElement("nav", { "aria-label": question?.title },
      question?.choices.map(choice => React.createElement("button", { key: choice.key, title: choice.hint, "data-visual": choice.visualConceptId, onClick: choice.choose }, choice.label))) };
  return originalLoad.call(this, name, parent, ...args);
};
const { restaurantSuggestions } = require("@/app/mois-a-venir/composer/restaurant-suggestions");
const { cinemaSuggestions } = require("@/app/mois-a-venir/composer/cinema-suggestions");
const { RestaurantEditor } = require("@/app/mois-a-venir/composer/restaurant-editor");
const { WorkshopComponentRow } = require("@/app/mois-a-venir/composer/workshop-component-row");
const { stageLocalDecision } = require("@/app/mois-a-venir/composer/local-draft");
const { InlineEditContext, InlineEditRegistry } = require("@/app/mois-a-venir/composer/inline-edit-registry");
const { handleComposerRequest } = require("@/server/phase2/planner/composer-service");
const { evaluatePlanScenario } = require("@/server/phase2/planner/preview");
const { editRestaurant } = require("@/domain/phase2/planner/restaurant-edit");
const { restaurantIncludedDetails } = require("@/domain/phase2/planner/restaurant-included-details");
const { componentId } = require("@/domain/phase2/planner/identity");
const fixture = await readMonthFixture();
const worldBefore = JSON.stringify(fixture.world);
const id = uuid(99701), mealId = uuid(99702), siblingId = uuid(99703), detailId = uuid(99704), extraId = uuid(99705);
const meal = { selectionId: mealId, optionKey: "restaurant", kind: "COMPONENT", provenance: "EXPLICIT_USER_DECISION",
  label: "Addition", quantity: "1", unitBasis: "SHARED", cost: { kind: "MANUAL", unitAmount: "40.00" },
  fundingAllocations: [], binding: { mode: "NO_RELATED_SLOT" } };
const context = { contextOccurrenceId: id, templateKey: "restaurant", status: "ACTIVE", parentContextOccurrenceId: null,
  fields: { fieldSchemaVersion: "context-fields@v2", label: "Restaurant homonyme" }, slotSelections: { meal: { items: [meal] } },
  provenance: "EXPLICIT_USER_DECISION" };
const sibling = { ...structuredClone(context), contextOccurrenceId: siblingId, slotSelections: {} };
const base = { ...fixture.semantic, contexts: [context, sibling] };
const included = { version: "restaurant-included-details@v1", mealSelectionId: mealId,
  items: [{ detailId, label: " BÍÈRE ", included: true, quantity: null, unitBasis: null,
    amount: { kind: "DECLARED_LINE_TOTAL", value: "6.00" }, provenance: "EXPLICIT_USER_DECISION" }] };
const withIncluded = editRestaurant(base, { contextOccurrenceId: id, includedDetails: included });
const extra = { ...meal, selectionId: extraId, optionKey: "extra", label: "Bière", cost: { kind: "MANUAL", unitAmount: "6.00" } };
const withExtra = editRestaurant(base, { contextOccurrenceId: id, slots: { extras: [extra] } });
const target = state => state.contexts.find(item => item.contextOccurrenceId === id);
const modelFor = async draft => {
  const response = await handleComposerRequest(fixture.deps, householdId, { kind: "READ", sequence: 0, targetMonth: "2026-11", draft });
  assert(response.ok, response.code);
  return response.model;
};
const candidates = model => restaurantSuggestions(target(model.semanticState), model.board.contexts.find(card => card.contextOccurrenceId === id), model, []);
const amounts = state => evaluatePlanScenario(fixture.world, state, { expectedActiveRevisionId: null, expectedActiveRevisionNumber: 0 })
  .compiled.components.filter(item => item.contextOccurrenceId === id).map(item => item.evaluation.economicAmount).sort();
const checks = [];
const check = async (name, run) => { await run(); checks.push(name); console.log(name + " PASS"); };
let root, current, model, registry, accepted, setCurrent;
function Harness() {
  const [state, setState] = React.useState(current);
  const [dismissed, setDismissed] = React.useState([]);
  setCurrent = setState;
  return React.createElement(InlineEditContext.Provider, { value: registry }, React.createElement(RestaurantEditor, {
    context: target(state), card: model.board.contexts.find(card => card.contextOccurrenceId === id), model, creating: false, busy: false,
    dismissedSuggestions: dismissed, updateSuggestionDismissal: (_id, key) => setDismissed(old => key === null ? [] : [...old, key]),
    close() {}, decide(operation) {
      const next = stageLocalDecision(model, current, operation);
      if (!next) return false;
      accepted.push(operation); current = next; setState(next); return true;
    }
  }));
}
const text = node => typeof node === "string" ? node : (node.children ?? []).map(text).join("");
const button = label => root.root.findAll(node => node.type === "button").find(node => text(node) === label);
const click = async label => { const node = button(label); assert(node, label); assert(!node.props.disabled, label); await act(async () => node.props.onClick()); };
const input = label => root.root.findAll(node => node.type === "label").find(node => text(node).startsWith(label)).findByType("input");
async function mount(state = base) {
  if (root) await act(async () => root.unmount());
  model = await modelFor(state); current = model.semanticState; registry = new InlineEditRegistry(); accepted = []; confirmation = null;
  await act(async () => { root = create(React.createElement(Harness)); });
}
try {
  await check("RS-01-FOUR-SITUATED-CHOICES-AND-PROVENANCE", async () => {
    const m = await modelFor(base), suggestions = candidates(m);
    assert.equal(suggestions[0].kind, "ADD_INCLUDED");
    assert.equal(suggestions[0].visualConceptId, "v22-art:excel:2");
    assert(suggestions[0].hint.includes("sans augmenter l’addition"));
    assert(suggestions.find(item => item.kind === "ADD_EXTRA").hint.includes("s’ajoute à l’addition"));
    await mount();
    const dock = root.root.findAllByType("nav").find(node => node.props["aria-label"] === "Suggestions pour ce restaurant");
    assert(dock); assert.equal(dock.findAllByType("button").length, 4);
  });
  await check("RS-02-CONSULTATION-RAW-AND-40-INCLUDED-6", async () => {
    await mount(); const before = JSON.stringify(current);
    await click("Renseigner une bière comprise"); assert.equal(JSON.stringify(current), before); assert.equal(accepted.length, 0);
    await act(async () => input("Montant de la ligne compris").props.onChange({ target: { value: "6,00" } }));
    await click("← Retour au résumé"); assert.equal(input("Montant de la ligne compris").props.value, "6,00"); assert.equal(registry.count(), 1);
    await act(async () => root.root.findByType("form").props.onSubmit({ preventDefault() {} }));
    assert.deepEqual(amounts(current), ["40.00"]); assert.equal(accepted.length, 1);
    assert.equal(restaurantIncludedDetails(target(current)).items[0].amount.value, "6.00");
    assert.deepEqual(current.contexts[1], base.contexts[1]);
  });
  await check("RS-03-DISTINCT-EXTRA-40-PLUS-6", async () => {
    await mount(withIncluded); await click("Préparer un supplément distinct");
    assert(confirmation); assert.equal(accepted.length, 0); await act(async () => confirmation.accept());
    let row = root.root.findByType(WorkshopComponentRow);
    await act(async () => row.props.onChange({ ...row.props.row, label: "Dessert", amount: "6.00", costMode: "MANUAL", edited: true }));
    await act(async () => root.root.findByType(WorkshopComponentRow).props.onSave());
    assert.deepEqual(amounts(current), ["40.00", "6.00"]);
    assert.equal(restaurantIncludedDetails(target(current)).items[0].detailId, detailId);
  });
  await check("RS-04-EXACT-EXISTING-IDENTITY-AND-HOMONYMS", async () => {
    const m = await modelFor(withIncluded), selected = candidates(m);
    assert.equal(selected[0].kind, "EDIT_INCLUDED"); assert.equal(selected[0].selectionId, detailId);
    assert(!selected.some(item => item.kind === "ADD_INCLUDED"));
    await mount(withExtra); await click("Modifier la bière en supplément");
    let row = root.root.findByType(WorkshopComponentRow);
    assert.equal(row.props.row.id, extraId); assert.equal(accepted.length, 0);
    await act(async () => row.props.onChange({ ...row.props.row, amount: "7.00", costMode: "MANUAL", edited: true }));
    await act(async () => root.root.findByType(WorkshopComponentRow).props.onSave());
    assert.equal(target(current).slotSelections.extras.items.length, 1); assert.equal(target(current).slotSelections.extras.items[0].selectionId, extraId);
    const duplicates = editRestaurant(withIncluded, { contextOccurrenceId: id, slots: { extras: [extra, { ...extra, selectionId: uuid(99706) }] } });
    assert.equal(candidates(await modelFor(duplicates))[0].kind, "CHOOSE_LINE");
    await mount(duplicates); await click("Choisir la bière à modifier");
    assert.equal(accepted.length, 0);
    const labels = root.root.findAllByType("button").map(text).map(label => label.replace(/\s+/g, " ").trim());
    assert(labels.some(label => /Bière.*supplément 1/.test(label))); assert(labels.some(label => /Bière.*supplément 2/.test(label)));
  });
  await check("RS-05-LOCAL-DISMISSAL-IS-NOT-A-DECISION", async () => {
    await mount(); const before = JSON.stringify(current);
    await click("Masquer · Renseigner une bière comprise"); assert(!button("Renseigner une bière comprise"));
    assert.equal(JSON.stringify(current), before); assert.equal(accepted.length, 0);
    await click("Réafficher les suggestions masquées"); assert(button("Renseigner une bière comprise"));
    assert.equal(accepted.length, 0);
  });
  await check("RS-06-CAPABILITIES-PRESERVE-AND-OCCURRENCE", async () => {
    const m = await modelFor(base), card = m.board.contexts.find(card => card.contextOccurrenceId === id);
    for (const blocked of [{ ...card, readOnly: true }, { ...card, capabilityRefs: [] }, { ...card, contextOccurrenceId: siblingId }])
      assert.deepEqual(restaurantSuggestions(target(m.semanticState), blocked, m, []), []);
    const protectedContext = structuredClone(m); protectedContext.semanticState.preferences.anchors.push(id);
    assert.deepEqual(candidates(protectedContext), []);
    const protectedMeal = structuredClone(m); protectedMeal.semanticState.preferences.anchors.push(componentId(id, "meal", mealId));
    assert(!candidates(protectedMeal).some(item => ["ADD_INCLUDED", "EDIT_INCLUDED", "BUDGET"].includes(item.kind)));
    const noExtra = structuredClone(m); noExtra.dropCapabilities = noExtra.dropCapabilities.filter(drop => drop.target.slotKey !== "extras");
    assert(!candidates(noExtra).some(item => item.kind === "ADD_EXTRA"));
    const noSlotCapability = structuredClone(m);
    noSlotCapability.board.contexts.find(card => card.contextOccurrenceId === id).sockets
      .find(socket => socket.slotKey === "extras").capabilityRefs = [];
    assert(!candidates(noSlotCapability).some(item => item.kind === "ADD_EXTRA"));
    const response = await handleComposerRequest(fixture.deps, householdId, { kind: "EDIT_RESTAURANT", sequence: 1, targetMonth: "2026-11",
      draft: protectedContext.semanticState, edit: { contextOccurrenceId: id, fields: { plannedDate: "2026-11-15" } } });
    assert.equal(response.ok, false);
  });
  await check("RS-07-NO-WRITERS-REMOTE-OR-WORLD-MUTATION", () => {
    assert.equal(remote, 0); assert.deepEqual(fixture.writes, []); assert.equal(JSON.stringify(fixture.world), worldBefore);
  });
  await check("RS-08-CONTEXT-METADATA-AND-MOBILITY-ADMISSION", async () => {
    const filled = structuredClone(base);
    target(filled).fields.participantRefs = [{ kind: "TEXT", label: "Personne synthétique" }];
    target(filled).fields.plannedDate = "2026-11-20";
    const m = await modelFor(filled);
    assert(!candidates(m).some(item => ["PARTICIPANTS", "DATE", "TRANSPORT"].includes(item.kind)));
    const place = { placeId: uuid(99709), name: "Restaurant synthétique" };
    const located = structuredClone(filled);
    target(located).fields.placeRef = { kind: "KNOWN", placeId: place.placeId };
    const locatedModel = await modelFor(located);
    locatedModel.mobilityOptions = { places: [place] };
    const route = candidates(locatedModel).find(item => item.kind === "TRANSPORT");
    assert(route); assert.equal(route.assetKey, "option:restaurant:transport:taxi");
    assert(!candidates(locatedModel).some(item => item.kind === "PLACE"));
    const blocked = structuredClone(locatedModel);
    blocked.dropCapabilities = blocked.dropCapabilities.filter(drop => drop.target.slotKey !== "transport");
    assert(!candidates(blocked).some(item => item.kind === "TRANSPORT"));
    const other = locatedModel.board.contexts.find(card => card.contextOccurrenceId === siblingId);
    const ownSuggestions = restaurantSuggestions(target(locatedModel.semanticState), other, locatedModel, []);
    assert.deepEqual(ownSuggestions, []);
  });
  await check("RS-09-STALE-EXTRA-KEEPS-RAW-AND-REFUSES-OVERWRITE", async () => {
    await mount(withExtra); await click("Modifier la bière en supplément");
    let row = root.root.findByType(WorkshopComponentRow);
    await act(async () => row.props.onChange({ ...row.props.row, amount: "7,00", costMode: "MANUAL", edited: true }));
    const changed = editRestaurant(current, { contextOccurrenceId: id, slots: { extras: [{ ...extra, label: "Bière modifiée ailleurs" }] } });
    await act(async () => { current = changed; setCurrent(changed); });
    await act(async () => root.root.findByType(WorkshopComponentRow).props.onSave());
    assert.equal(accepted.length, 0); assert.equal(registry.count(), 1);
    assert.equal(root.root.findByType(WorkshopComponentRow).props.row.amount, "7,00");
    assert.equal(target(current).slotSelections.extras.items[0].label, "Bière modifiée ailleurs");
  });
  await check("RS-10-CINEMA-S1-S2-REGRESSION", () => {
    const input = { contextOccurrenceId: uuid(99720), writable: true, ticketAllowed: true, dayChosen: false,
      placeChosen: false, extrasAllowed: true, extras: [], transport: { label: "Taxi", iconKey: "taxi" },
      complementsOnly: false, dismissed: [] };
    const suggestions = cinemaSuggestions(input);
    assert.deepEqual(suggestions.map(item => item.conceptKey), ["billet-cinema", "jour-seance", "lieu-cinema", "popcorn"]);
    assert.deepEqual(suggestions[0].source,{kind:"EXCEL",id:"v22-art:excel:329",label:"Billet de cinéma"});
    assert.equal(suggestions.find(item => item.conceptKey === "popcorn").source.kind, "BUSINESS");
    assert.deepEqual(cinemaSuggestions({ ...input, writable: false, ticketAllowed: false, extrasAllowed: false, transport: undefined }), []);
    const popcorn = { selectionId: uuid(99721), label: " PÓPCORN ", locked: false };
    const extrasOnly = { ...input, complementsOnly: true, transport: undefined };
    const selected = cinemaSuggestions({ ...extrasOnly, extras: [popcorn] });
    assert.equal(selected[0].action, "EDIT"); assert.equal(selected[0].selectionId, popcorn.selectionId);
    const duplicate = { ...popcorn, selectionId: uuid(99722) };
    assert.deepEqual(cinemaSuggestions({ ...extrasOnly, extras: [popcorn, duplicate] }).map(item => item.conceptKey), ["boisson"]);
    assert.deepEqual(cinemaSuggestions({ ...extrasOnly, extras: [{ ...popcorn, locked: true }] }).map(item => item.conceptKey), ["boisson"]);
    const dismissed = { ...input, dismissed: [suggestions[0].key] };
    assert(!cinemaSuggestions(dismissed).some(item => item.conceptKey === "billet-cinema"));
    assert.equal(cinemaSuggestions({ ...dismissed, contextOccurrenceId: uuid(99723) })[0].conceptKey, "billet-cinema");
    const ticket = cinemaSuggestions({ ...dismissed, ticket: { selectionId: uuid(99724), label: "Billet" } })
      .find(item => item.conceptKey === "billet-cinema");
    assert.equal(ticket.action, "EDIT"); assert.equal(ticket.selectionId, uuid(99724));
    const drink = { selectionId: uuid(99725), label: "Boisson", locked: false };
    const ready = { ...input, dayChosen: true, placeChosen: true, extras: [drink] };
    const ranked = cinemaSuggestions(ready);
    assert.deepEqual(ranked.map(item => item.conceptKey), ["billet-cinema", "boisson", "popcorn", "taxi"]);
    assert.equal(ranked[1].selectionId, drink.selectionId);
    assert(!cinemaSuggestions({ ...ready, transport: undefined }).some(item => item.category === "transport"));
  });
  await check("RS-11-ACTIVITY-HOMONYMS-KEEP-EXACT-LINE-AND-ORDER", async () => {
    const first = { ...extra, label: "Location de chaussures" };
    const second = { ...first, selectionId: uuid(99730) };
    const bowling = { ...target(base), templateKey: "activity", fields: {
      fieldSchemaVersion: "context-fields@v2", label: "Bowling",
      composerPresentation: { version: "composer-context-presentation@v1", presetKey: "bowling" },
    }, slotSelections: { main: { items: [{ ...meal, optionKey: "activity", label: "Partie" }] }, extras: { items: [first, second] } } };
    await mount({ ...base, contexts: [bowling] });
    assert.equal(button("Modifier · Partie").props["data-visual"], "v22-art:excel:342");
    await click("Modifier · Partie");
    const budgetDock = root.root.findAllByType("nav").find(node => node.props["aria-label"] === "Quel budget souhaitez-vous prévoir ?");
    assert(budgetDock);assert(!budgetDock.findAllByType("button").some(node => ["Coût total", "Détailler"].includes(text(node))));
    assert.equal(accepted.length, 0);
    await click("← Retour au résumé");
    const menu = root.root.findAllByType("button").find(node => text(node).includes("Compléments et trajet"));
    assert(menu); await act(async () => menu.props.onClick());
    const firstLine = root.root.findAllByType("button").find(node => text(node).endsWith("complément 1"));
    const secondLine = root.root.findAllByType("button").find(node => text(node).endsWith("complément 2"));
    assert(firstLine && secondLine); assert.equal(accepted.length, 0);
    await act(async () => firstLine.props.onClick());
    const row = root.root.findByType(WorkshopComponentRow);
    assert.equal(row.props.row.id, first.selectionId);
    await act(async () => row.props.onChange({ ...row.props.row, amount: "7.00", costMode: "MANUAL", edited: true }));
    await act(async () => root.root.findByType(WorkshopComponentRow).props.onSave());
    assert.equal(accepted.length, 1);
    const revised = target(current).slotSelections.extras.items;
    assert.deepEqual(revised.map(item => item.selectionId), [first.selectionId, second.selectionId]);
    assert.equal(revised[0].cost.unitAmount, "7.00"); assert.deepEqual(revised[1], second);
    assert.deepEqual(amounts(current), ["40.00", "6.00", "7.00"]);
  });
  console.log(JSON.stringify({ status: "PASS", checks, level: "LOCAL_REACT_AND_FINANCE_FIXTURE", remote, writers: fixture.writes.length, apply: false }));
} finally {
  if (root) await act(async () => root.unmount());
  Module._load = originalLoad;
}
