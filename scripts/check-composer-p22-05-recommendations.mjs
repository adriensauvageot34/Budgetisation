import assert from "node:assert/strict";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { require } from "./lib/phase2-ts-loader.mjs";
import { fixture, householdId, state, uuid } from "./fixtures/planner-headless.mjs";

const { handleComposerRequest } = require("@/server/phase2/planner/composer-service");
const { composerLibraryIndex, filterLibraryIntentions, librarySearchAction } = require("@/domain/phase2/planner/composer-library-index");
const { libraryRecommendations, searchRecommendedIntents, searchRecommendedOccurrences } = require("@/app/mois-a-venir/composer/library-recommendations");
const { availableProjectStarters } = require("@/app/mois-a-venir/composer/project-starters");
const { catalogResults, discoveryActions } = require("@/app/mois-a-venir/composer/catalog-discovery");
const { cinemaSuggestions } = require("@/app/mois-a-venir/composer/cinema-suggestions");
const { semanticStateDigest } = require("@/domain/phase2/planner/semantic-state");
const { plannerDigest } = require("@/domain/phase2/planner/json");
const { v22Concepts, workbookSource, rankCatalogRecommendations } = require("@/app/mois-a-venir/composer/catalog-relevance");
const entries = JSON.parse(fs.readFileSync("public/planned-visuals/builder/clay/v22/collection.json", "utf8")).entries;
const byId = new Map(entries.map(entry => [entry.visualConceptId, entry]));
const targetMonth = "2026-11", world = fixture();
const deps = { repository: { readActivePlan: async () => null, applyPlan: async () => { throw Error("Apply forbidden"); } },
  readWorld: async () => world, householdPersons: [] };
let draft = state(), count = 0;
async function action(operation) {
  const response = await handleComposerRequest(deps, householdId, { ...operation, sequence: ++count, targetMonth, draft });
  assert.equal(response.ok,true,JSON.stringify(response));
  draft = response.model.semanticState;
  return response.model;
}
const create = (template, presetKey, identity, purchaseBasket) => action({ kind: "DROP", assetKey: "template:"+template,
  target: {kind:"BOARD_ZONE"}, identity, selectionId: crypto.randomUUID(), presetKey, values: {}, ...(purchaseBasket ? {purchaseBasket:true} : {}) });

for (const concept of Object.values(v22Concepts)) {
  const entry = byId.get(concept.id);
  assert(entry?.discovery.contexts.includes(concept.topic), concept.id);
  assert.equal(entry.label.replaceAll("’", "'"), concept.label.replaceAll("’", "'"));
  assert.equal(entry.discovery.provenance, "EXCEL_NAME_FAMILY");
}
assert.equal(entries.filter(entry => entry.discovery.provenance === "EXCEL_NAME_FAMILY").length,529);
const baseline = await action({kind:"READ"});
const index = composerLibraryIndex(baseline);
const recommend = (model, category) => libraryRecommendations(model, composerLibraryIndex(model),
  {category, projects: availableProjectStarters(model)});
const general = recommend(baseline);
assert(general.length > 0 && general.length <= 4);
assert(general.some(row=>row.kind==="PROJECT") && general.some(row=>row.kind==="ADD"));
assert(general.every(idea=>idea.reason.length > 0));
const query = searchRecommendedIntents(index.intentions,"Billet de cinéma");
assert(query.some(item=>item.preset?.presetKey==="cinema"));
const leisure = recommend(baseline,"ACTIVITY");
assert(leisure.some(row=>row.label==="Bowling"));
assert(leisure.every(row=>row.group==="ACTIVITY"));
assert(!recommend(baseline,"HOME").some(row=>row.label==="Cinéma"));
assert.deepEqual(recommend(baseline,"category-unmapped"),[]);
const equipment = byId.get("v22-art:excel:366");
assert.deepEqual(discoveryActions(equipment,baseline,{scope:"activity"}),[]);
const absent={...baseline,dropCapabilities:[],board:{...baseline.board,contexts:[]}};
assert.deepEqual(recommend(absent),[]);
assert.deepEqual(recommend(baseline).map(row=>row.key),general.map(row=>row.key));

const anon = [{key:"a",tiers:[0],source:workbookSource(v22Concepts.ticket)},
  {key:"b",tiers:[0],source:workbookSource(v22Concepts.mascara)}];
const profile = {subject:"member-b",values:[{conceptId:v22Concepts.ticket.id,value:"JAMAIS"},{conceptId:v22Concepts.mascara.id,value:"SOUVENT"}]};
assert.deepEqual(rankCatalogRecommendations(anon,{authorizedSubject:"member-a",profile}),anon);
assert.deepEqual(rankCatalogRecommendations(anon,{authorizedSubject:"member-b",profile}).map(row=>row.key),["b","a"]);
assert.equal(rankCatalogRecommendations([{...anon[0],tiers:[0]},{...anon[1],tiers:[1]}],{authorizedSubject:"member-b",profile})[0].key,"a");
assert.deepEqual(rankCatalogRecommendations([...anon].reverse()),anon);
assert(query.some(item=>item.preset?.presetKey==="cinema")); // Private tier cannot remove an explicit result.

const amazon = uuid(31001), line = uuid(31002), line2 = uuid(31003);
await create("purchase","amazon-purchase",amazon,true);
const article = async (selectionId) => action({kind:"EDIT_PURCHASE_BASKET",edit:{contextOccurrenceId:amazon,
  expectedContextDigest:plannerDigest(draft.contexts.find(row=>row.contextOccurrenceId===amazon)),change:{kind:"SAVE_ITEM",
    selectionId,label:"Mascara",quantity:"1",price:"",unit:"UNIT",concept:{id:v22Concepts.mascara.id,label:"Mascara"}}}});
await article(line);
const populated = await article(line2);
const digest = semanticStateDigest(draft);
const matches = discoveryActions(byId.get(v22Concepts.mascara.id),populated,{scope:"all"});
assert.deepEqual(matches.map(row=>[row.kind,row.contextId,row.focus]),[
  ["OPEN",amazon,"basket-item:"+line],["OPEN",amazon,"basket-item:"+line2]]);
assert(recommend(populated).some(row=>row.kind==="OPEN" && row.occurrence.contextOccurrenceId===amazon));
const populatedIndex = composerLibraryIndex(populated);
assert.deepEqual(librarySearchAction(searchRecommendedIntents(populatedIndex.intentions,"Amazon"),
  filterLibraryIntentions(populatedIndex.occurrences,"Amazon"),"Amazon"),{kind:"OPEN",contextOccurrenceId:amazon});
assert(!recommend(populated).some(row=>row.kind==="ADD" && row.item.preset.presetKey==="amazon-purchase"));
assert.equal(semanticStateDigest(draft),digest);
const cinemaId = uuid(31006);
const withCinema = await create("activity","cinema",cinemaId);
assert(searchRecommendedOccurrences(composerLibraryIndex(withCinema).occurrences,"Billet de cinéma")
  .some(row=>row.contextOccurrenceId===cinemaId));
const cinema = {contextOccurrenceId:uuid(31004),writable:true,ticketAllowed:true,dayChosen:false,placeChosen:false,extrasAllowed:true,
  extras:[],complementsOnly:false,dismissed:[]};
const offers = cinemaSuggestions(cinema);
assert.equal(offers[0].source.kind,"EXCEL");
assert.equal(offers.find(row=>row.conceptKey==="popcorn").source.kind,"BUSINESS");
assert(!offers.some(row=>row.category==="transport"));
assert.equal(cinemaSuggestions({...cinema,ticket:{selectionId:line,label:"Billet"}})[0].selectionId,line);
assert(!cinemaSuggestions({...cinema,dismissed:[offers[0].key]}).some(row=>row.key===offers[0].key));
assert(cinemaSuggestions({...cinema,contextOccurrenceId:uuid(31005),dismissed:[offers[0].key]}).some(row=>row.conceptKey==="billet-cinema"));

const elapsed = [];
for (let i=0;i<40;i++){
  const start=performance.now();
  catalogResults(entries,{query:["billet","mascara","", "parking"][i%4],scope:i%3===0?"cinema":"all"});
  elapsed.push(performance.now()-start);
}
elapsed.sort((a,b)=>a-b);
console.log(JSON.stringify({status:"PASS",general:general.map(row=>[row.kind,row.label]),leisure:leisure.map(row=>row.label),
  catalogEntries:entries.length, catalogMs:{median:elapsed[20],p95:elapsed[37]},cases:{"cartes":8,oracles:["CAT-01","CAT-02","CAT-03","CAT-05","CAT-07","CAT-08","CAT-11","CAT-12","CAT-15","CAT-16","CAT-18","CAT-19"]}}));
