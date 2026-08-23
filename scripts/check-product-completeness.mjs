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
for (const [condition, reason] of [
  [/PERMISSION_DENIED/.test(apiRoute) && /status:\s*authenticationRequired\s*\?\s*401/.test(apiRoute), "/api/query ne garantit pas le 401 JSON"],
  [/startsWith\(\"\/api\/\"\)/.test(authProxy) && /if \(isApi\) return response/.test(authProxy), "le proxy peut encore rediriger /api/*"],
  [/content-type/.test(queryClient) && /contenu non JSON/.test(queryClient), "le client Query ne défend pas le contenu non JSON"],
  [!/\bas never\b/.test(globalPage), "renderer Analysis Global contient encore un cast never"],
  [/request\.scope\.time\.kind === \"global\"[\s\S]{0,120}\"activity_causal_cost\"/.test(globalSources), "Activity ciblée Global n'a pas de métrique agrégable"],
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
