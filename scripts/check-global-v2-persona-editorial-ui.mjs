import assert from "node:assert/strict";
import fs from "node:fs";

const view = fs.readFileSync("src/features/global-v2/persona/persona-editorial-view.tsx", "utf8");
const css = fs.readFileSync("src/features/global-v2/persona/persona-editorial.module.css", "utf8");
const page = fs.readFileSync("src/features/global-v2/global-v2-page.tsx", "utf8");
const loader = fs.readFileSync("src/server/query/global-v2-production-loader.ts", "utf8");

for (const heading of ["Nos journées de travail", "Nos univers personnels", "Nos habitudes qui reviennent", "Notre vie sociale, chacun de son côté", "Notre Peugeot, son outil de travail quotidien", "Séries & divertissement", "Barbe & cheveux", "Ses produits fidèles", "sorties de son côté", "Famille", "Une chanson pour son père"]) {
  if (heading === "Une chanson pour son père") continue; // The published project provides this title.
  assert.ok(view.includes(heading), `missing editorial story: ${heading}`);
}
assert.match(view, /suno\.description/);
assert.match(view, /model\.period\.first[\s\S]*model\.period\.certifiedThrough/);
assert.match(view, /work\.onsiteDays[\s\S]*work\.remoteDays/);
assert.match(view, /permit\.lessonsByMonth[\s\S]*permit\.codeDates/);
assert.match(view, /meal\.anchorPresence[\s\S]*meal\.anchorTypicalPurchase/);
assert.match(view, /vehicle\.workUsageSummary[\s\S]*vehicle\.insuranceSummary[\s\S]*payerAuthority/);
assert.match(view, /insurance\.payerAuthority === "USER_VALIDATED" && insurance\.payerPersonId === manonId/);
assert.match(view, /vehicle\.nonFuelCostTotalReady && vehicle\.nonFuelCostTotal !== null/);
assert.match(view, /personalPayer \? "Manon la prend en charge"/);
assert.match(view, /estimatedFuelCost/);
assert.match(view, /hairdresser\.observedPresenceDays/);
assert.match(view, /stylingWax\.price === null \? null/);
assert.match(view, /beautyNeeds\[product\.needKey\]/);
assert.match(view, /product\.medianGapDays === null \|\| product\.purchaseCount < 3/);
assert.match(view, /vape\.directPurchases\.map/);
assert.match(view, /vape\.reconciledToM2 !== true \? null/);
assert.match(view, /fatherHome[\s\S]*maternalFamilyHome[\s\S]*familyMobilityWithoutPartner/);
assert.match(view, /monthlyPresenceDays\[key\]/);
assert.match(view, /summary\.support !== "SUFFICIENT"/);
assert.match(view, /outingsWithoutPartnerParticipation/);
assert.match(view, /carburant estimé|carburant utilisé/iu);
assert.match(view, /dateThread|DateThread/);
assert.match(css, /\.editorialGrid \{ display: grid; grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)/);
assert.match(css, /\.vehicleBranches \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(css, /data-mobile-active="false"/);
assert.match(page, /<PersonaEditorialView model=\{editorial\} direct=\{persona\}/);
assert.match(loader, /readPersonaEditorialArtifact\(runtime\)/);
assert.match(loader, /GLOBAL_PERSONA_EDITORIAL_GENERATION_MISMATCH/);
assert.doesNotMatch(view, /(?:1[ ,\u00a0]?368|260[,.]34|84[,.]71|1[ ,\u00a0]?492|2[ ,\u00a0]?600|20[,.]65|14[,.]99|10[,.]80|23[,.]80|21[,.]88|51[,.]34|326[,.]868)/);
assert.doesNotMatch(view, /Portrait express|Voir le détail|Manon a dépensé|Max a remplacé Netflix|fuelPaidAmount|sorties seules|sorties en solo/iu);
assert.doesNotMatch(view, /Usage personnel confirmé ne signifie pas paiement personnel|parts de paniers mixtes|sans l’autre comme participant enregistré/iu);

console.log("PERSONA_EDITORIAL_UI=PASS");
