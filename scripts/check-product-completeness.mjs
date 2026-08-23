import fs from "node:fs";
import path from "node:path";

const repositoryRoot = process.cwd();
const completedRoots = [
  "src/app/historique",
  "src/app/operations",
  "src/features/calendar",
  "src/features/analysis",
  "src/features/operations",
  "src/features/exploration",
  "src/components/runtime",
];

function collectFiles(root) {
  const absolute = path.join(repositoryRoot, root);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolute, entry.name);
    return entry.isDirectory()
      ? collectFiles(path.relative(repositoryRoot, child))
      : /\.(?:ts|tsx)$/.test(entry.name)
        ? [child]
        : [];
  });
}

const violations = [];
const forbidden = [
  [/\bModuleComingSoon\b/, "ModuleComingSoon sur une surface terminée"],
  [/Analysis reste hors de ce lot/i, "placeholder Analysis historique"],
  [/Targeted Analysis(?: reste| hors| à venir)/i, "placeholder Targeted Analysis"],
  [/\bcreateBootstrapSources\b/, "bootstrap synthétique utilisé comme source produit"],
  [/\bunknownScopedMetric\b/, "unknownScopedMetric utilisé comme implémentation produit"],
];

for (const file of completedRoots.flatMap(collectFiles)) {
  const content = fs.readFileSync(file, "utf8");
  for (const [pattern, reason] of forbidden) {
    if (pattern.test(content)) {
      violations.push(`${path.relative(repositoryRoot, file)}: ${reason}`);
    }
  }
}

const futureAllowlist = [
  "src/app/imports/page.tsx",
  "src/app/parametres/page.tsx",
];
for (const relative of futureAllowlist) {
  const content = fs.readFileSync(path.join(repositoryRoot, relative), "utf8");
  if (!/\bModuleComingSoon\b/.test(content)) {
    violations.push(`${relative}: route future absente de l'allowlist explicite`);
  }
}

const legacyCategory = fs.readFileSync(
  path.join(repositoryRoot, "src/app/categorie/[slug]/page.tsx"),
  "utf8",
);
if (!/\bnotFound\(\)/.test(legacyCategory)) {
  violations.push("src/app/categorie/[slug]/page.tsx: route legacy non neutralisée");
}
if (/parseCategoryId|\bas\s+CategoryId\b/.test(legacyCategory)) {
  violations.push("src/app/categorie/[slug]/page.tsx: slug traité comme CategoryId");
}

const apiRoute = fs.readFileSync(path.join(repositoryRoot, "src/app/api/query/route.ts"), "utf8");
const authProxy = fs.readFileSync(path.join(repositoryRoot, "src/lib/supabase/proxy.ts"), "utf8");
const queryClient = fs.readFileSync(path.join(repositoryRoot, "src/components/runtime/query-client.ts"), "utf8");
const globalPage = fs.readFileSync(path.join(repositoryRoot, "src/features/analysis/global/analysis-global-page.tsx"), "utf8");
const globalSources = fs.readFileSync(path.join(repositoryRoot, "src/server/query/sources/analysis.ts"), "utf8");
const canonicalRepository = fs.readFileSync(
  path.join(repositoryRoot, "src/server/canonical/repository.ts"),
  "utf8",
);
const operationsSource = fs.readFileSync(
  path.join(repositoryRoot, "src/server/query/sources/operations.ts"),
  "utf8",
);
const operationEvidence = fs.readFileSync(
  path.join(repositoryRoot, "src/features/exploration/operation-evidence.tsx"),
  "utf8",
);
const operationsParams = fs.readFileSync(
  path.join(repositoryRoot, "src/query-api/request/operations-params.ts"),
  "utf8",
);
for (const [condition, reason] of [
  [/PERMISSION_DENIED/.test(apiRoute) && /status:\s*authenticationRequired\s*\?\s*401/.test(apiRoute), "/api/query ne garantit pas le 401 JSON"],
  [/startsWith\(\"\/api\/\"\)/.test(authProxy) && /if \(isApi\) return response/.test(authProxy), "le proxy peut encore rediriger /api/*"],
  [/content-type/.test(queryClient) && /contenu non JSON/.test(queryClient), "le client Query ne défend pas le contenu non JSON"],
  [!/\bas never\b/.test(globalPage), "renderer Analysis Global contient encore un cast never"],
  [/request\.scope\.time\.kind === \"global\"[\s\S]{0,120}\"activity_causal_cost\"/.test(globalSources), "Activity ciblée Global n'a pas de métrique agrégable"],
  [!/\.from\("operations"\)[\s\S]{0,240}\.eq\("household_id"/.test(canonicalRepository), "une lecture operations dépend encore de operations.household_id"],
  [/canonical_household_scope_control/.test(canonicalRepository) && /parseCanonicalHouseholdScope/.test(canonicalRepository), "le scope Household canonique n'est pas validé avant les lectures Operations"],
  [/loadOperationsByBankRange\([\s\S]{0,220}await this\.assertAuthorizedCanonicalHouseholdScope\(\)/.test(canonicalRepository), "loadOperationsByBankRange ne valide pas le scope Household canonique"],
  [/loadLatestBankOperationMonth\([\s\S]{0,220}await this\.assertAuthorizedCanonicalHouseholdScope\(\)/.test(canonicalRepository), "loadLatestBankOperationMonth ne valide pas le scope Household canonique"],
  [/loadOperationsByIds\([\s\S]{0,240}await this\.assertAuthorizedCanonicalHouseholdScope\(\)/.test(canonicalRepository), "loadOperationsByIds ne valide pas le scope Household canonique"],
  [/probeCanonicalSource\("operations"[\s\S]{0,180}await this\.assertAuthorizedCanonicalHouseholdScope\(\)/.test(canonicalRepository), "le health check Operations ne valide pas le scope Household canonique"],
  [/loadOperation\(operationId[\s\S]{0,220}loadOperationsByIds\(\[operationId\]\)/.test(canonicalRepository), "loadOperation ne délègue plus à loadOperationsByIds"],
  [/canonical_read_error/.test(canonicalRepository), "la journalisation sûre canonical_read_error est absente"],
  [!/\.from\("places"\)/.test(canonicalRepository), "le runtime lit encore la fausse table physique places"],
  [!/\.from\("life_events"\)[\s\S]{0,260}\.eq\("household_id"/.test(canonicalRepository), "life_events dépend encore d'un household_id physique"],
  [!/\.from\("merchants"\)[\s\S]{0,220}\.eq\("household_id"/.test(canonicalRepository), "merchants dépend encore d'un household_id physique"],
  [!/montant_bancaire::text/.test(canonicalRepository), "Operations sélectionne encore montant_bancaire inexistant"],
  [/montant_bancaire_exact:montant::text/.test(canonicalRepository), "Operations ne projette pas montant comme Money exact"],
  [/referentiel_lieu/.test(canonicalRepository), "Place n'est pas mappé sur referentiel_lieu"],
  [/withdrawal_operation_id/.test(canonicalRepository) && /operation_id:withdrawal_operation_id/.test(canonicalRepository), "Cash composition n'utilise pas withdrawal_operation_id avec alias logique"],
  [/composition_amount_exact/.test(canonicalRepository), "les montants de composition ne sont pas projetés comme texte exact"],
  [!/Ajustable/.test(operationsSource) && !/Ajustable/.test(operationEvidence), "Ajustable est encore fusionné vers Optionnel"],
  [/record\.amountMin === undefined \|\| record\.amountMin === null/.test(operationsParams) && /record\.amountMax === undefined \|\| record\.amountMax === null/.test(operationsParams), "amountMin/amountMax ne neutralisent pas undefined et null"],
]) {
  if (!condition) violations.push(reason);
}

if (violations.length > 0) {
  console.error("Product completeness check: FAIL");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Product completeness check: PASS (${completedRoots.length} surfaces, ${futureAllowlist.length} routes futures)`);
}
