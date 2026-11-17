import Link from "next/link";
import { redirect } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { readMerchantBadgeCatalog } from "@/server/commerce/merchant-badge-catalog";
import { MERCHANT_GENERIC_BADGE_LABELS } from "@/core/identity/merchant-kind";

export const metadata = { title: "Référentiel des marchands" };
export const dynamic = "force-dynamic";

const policyLabels = { normal: "Illustration autorisée", reuse_only: "Réutilisation uniquement", none: "Exclu des illustrations" };
const fold = (value: string) => value.toLocaleLowerCase("fr").normalize("NFD").replace(/\p{Diacritic}/gu, "");

export default async function SettingsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; vue?: string; secteur?: string }>;
}) {
  const { supabase } = await withProductAuthentication(getAuthenticatedBootstrapClient);
  const household = await getCurrentHousehold(supabase);
  if (!household) redirect("/acces-refuse");
  const [catalog, params] = await Promise.all([readMerchantBadgeCatalog(household.householdId), searchParams]);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const generation = params.vue === "generation";
  const term = fold(query);
  const sectors = [...new Set(catalog.flatMap(row => row.activity ? [row.activity.sector] : []))]
    .sort((a, b) => a.localeCompare(b, "fr"));
  const sector = typeof params.secteur === "string" && sectors.includes(params.secteur) ? params.secteur : "";
  const rows = catalog.filter(row => (!generation || row.toIllustrate)
    && (!sector || row.activity?.sector === sector)
    && (!term || [row.label, row.canonicalLabel, row.activity?.label ?? ""].some(value => fold(value).includes(term))));

  return <section className="space-y-5">
    <h1 className="text-2xl font-black">Référentiel des marchands</h1>
    <nav aria-label="Vues du référentiel" className="flex flex-wrap gap-2">
      <Link href="/parametres" className="button-ghost" aria-current={!generation ? "page" : undefined}>Toutes les fiches</Link>
      <Link href="/parametres?vue=generation" className="button-ghost" aria-current={generation ? "page" : undefined}>À illustrer</Link>
    </nav>
    {generation && <p className="text-sm text-[var(--color-muted)]">Fiches éligibles à une illustration individuelle. Un badge de secours par activité peut déjà s’afficher.</p>}
    <form method="get" className="flex flex-wrap items-end gap-2">
      {generation && <input type="hidden" name="vue" value="generation" />}
      <label className="grid gap-1 text-sm font-semibold">Marchand ou activité
        <input name="q" type="search" maxLength={120} defaultValue={query}
          className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2" />
      </label>
      <label className="grid gap-1 text-sm font-semibold">Secteur
        <select name="secteur" defaultValue={sector}
          className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2">
          <option value="">Tous les secteurs</option>
          {sectors.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <button className="button-ghost">Rechercher</button>
    </form>
    <p className="text-sm text-[var(--color-muted)]">{rows.length} {rows.length === 1 ? "fiche" : "fiches"}</p>
    <ul className="card divide-y divide-[var(--color-border)] px-4">
      {rows.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3">
        <div>
          <span className="font-semibold">{row.label}
            {row.label !== row.canonicalLabel && <small className="ml-2 font-normal text-[var(--color-muted)]">{row.canonicalLabel}</small>}
          </span>
          <div className="text-sm text-[var(--color-muted)]" data-merchant-activity>
            {row.activity?.label ?? "Activité à déterminer"}
            {row.activityReviewRequired && " · À confirmer"}
            {row.fallbackBadge && ` · ${row.fallbackPublished ? "Secours" : "Secours prévu"} ${MERCHANT_GENERIC_BADGE_LABELS[row.fallbackBadge]}`}
          </div>
        </div>
        <span className="text-sm text-[var(--color-muted)]" data-badge-policy={row.policy}>
          {policyLabels[row.policy]}
          {row.kind === "unknown" && generation ? " · Identité à confirmer" : ""}
        </span>
      </li>)}
    </ul>
  </section>;
}
