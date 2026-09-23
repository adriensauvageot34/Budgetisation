import assert from "node:assert/strict";
import fs from "node:fs";

const view = fs.readFileSync("src/features/global-v2/persona/persona-editorial-view.tsx", "utf8");
const css = fs.readFileSync("src/features/global-v2/persona/persona-editorial.module.css", "utf8");
const page = fs.readFileSync("src/features/global-v2/global-v2-page.tsx", "utf8");
const server = fs.readFileSync("src/server/analytics/global-v2-persona-editorial.ts", "utf8");
const loader = fs.readFileSync("src/server/query/global-v2-production-loader.ts", "utf8");
const portraitRoute = fs.readFileSync("src/app/api/persona-portrait/[name]/route.ts", "utf8");
const portraitMigration = fs.readFileSync("supabase/migrations/20260923131118_private_persona_portraits.sql", "utf8");

for (const heading of ["Nos profils", "Nos journées de travail", "Nos univers personnels", "Nos habitudes qui reviennent", "Notre vie sociale, chacun de son côté", "Le permis", "Notre Peugeot", "Repas au travail", "Séries & divertissement", "Barbe & cheveux", "Ses produits fidèles", "Famille", "Amis", "Vape", "Cigarettes", "Tabac"]) {
  assert.ok(view.includes(heading), `missing profile story: ${heading}`);
}
assert.match(view, /Image src="\/api\/persona-portrait\/adrien" alt="Portrait d’Adrien"/);
assert.match(view, /Image src="\/api\/persona-portrait\/manon" alt="Portrait de Manon"/);
assert.match(css, /border-radius: 50%/);
assert.match(css, /object-fit: cover/);
assert.match(view, /button type="button" disabled aria-label="Nous deux, bientôt disponible"/);
assert.doesNotMatch(page, /"PERSONAS", "TOGETHER"/);
assert.match(view, /meal\.allPurchaseHabitSummary/);
assert.match(server, /allPurchaseHabitSummary/);
assert.match(view, /vape\.equipmentCost/);
assert.match(view, /cigarettesPerDay/);
assert.match(view, /approximateMonthlyBudget/);
assert.match(view, /friendVisits/);
assert.match(view, /familyMobility/);
assert.match(server, /mobility\(manon, "FAMILY_VISIT"\)/);
assert.match(server, /mobility\(manon, "FRIEND_VISIT"\)/);
assert.match(server, /visitEpisodeStarts/);
assert.match(server, /videoObservedCost/);
assert.match(view, /videoObservedCost/);
assert.match(css, /--adrien-bg: #ebf3f8/);
assert.match(css, /--manon-bg: #f8edf1/);
assert.match(portraitRoute, /getAuthenticatedBootstrapClient/);
assert.match(portraitRoute, /getCurrentHousehold/);
assert.match(portraitRoute, /private, no-store/);
assert.match(portraitMigration, /'persona-portraits', 'persona-portraits', false/);
assert.match(loader, /readPersonaEditorialArtifact\(runtime\)/);
assert.doesNotMatch(view, /Son travail la fait aussi bouger|PORTRAITS PERSONNELS|Deux quotidiens, deux façons de dépenser|Ce que nos trajets et nos pauses racontent|sur un an à ce rythme|prix indicatif|présences repérées/iu);
assert.doesNotMatch(view, /(?:1[ ,\u00a0]?368|260[,.]34|84[,.]71|1[ ,\u00a0]?492|2[ ,\u00a0]?600|20[,.]65|14[,.]99|10[,.]80|23[,.]80|21[,.]88|51[,.]34|326[,.]868)/);

console.log("PERSONA_EDITORIAL_UI=PASS");
