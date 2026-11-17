import Link from "next/link";
import { redirect } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { getAuthenticatedBootstrapClient } from "@/server/bootstrap/auth";
import { getCurrentHousehold } from "@/server/bootstrap/queries";
import { readMerchantBadgeCatalog } from "@/server/commerce/merchant-badge-catalog";

export const metadata = { title: "Référentiel des marchands" };
export const dynamic = "force-dynamic";

const policyLabels = { normal: "Illustration autorisée", reuse_only: "Réutilisation uniquement", none: "Exclu des illustrations" };
const fold = (value: string) => value.toLocaleLowerCase("fr").normalize("NFD").replace(/\p{Diacritic}/gu, "");

export default async function SettingsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; vue?: string }>;
}) {
  const { supabase } = await withProductAuthentication(getAuthenticatedBootstrapClient);
  const household = await getCurrentHousehold(supabase);
  if (!household) redirect("/acces-refuse");
  const [catalog, params] = await Promise.all([readMerchantBadgeCatalog(household.householdId), searchParams]);
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const generation = params.vue === "generation";
  const term = fold(query);
  const rows = catalog.filter(row => (!generation || row.toIllustrate)
    && (!term || fold(row.label).includes(term) || fold(row.canonicalLabel).includes(term)));

  return <section className="space-y-5">
    <h1 className="text-2xl font-black">Référentiel des marchands</h1>
    <nav aria-label="Vues du référentiel" className="flex flex-wrap gap-2">
      <Link href="/parametres" className="button-ghost" aria-current={!generation ? "page" : undefined}>Toutes les fiches</Link>
      <Link href="/parametres?vue=generation" className="button-ghost" aria-current={generation ? "page" : undefined}>À illustrer</Link>
    </nav>
    {generation && <p className="text-sm text-[var(--color-muted)]">Fiches autorisées pour une illustration individuelle et sans badge publié dans l’app.</p>}
    <form method="get" className="flex flex-wrap items-end gap-2">
      {generation && <input type="hidden" name="vue" value="generation" />}
      <label className="grid gap-1 text-sm font-semibold">Marchand
        <input name="q" type="search" maxLength={120} defaultValue={query}
          className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2" />
      </label>
      <button className="button-ghost">Rechercher</button>
    </form>
    <p className="text-sm text-[var(--color-muted)]">{rows.length} {rows.length === 1 ? "fiche" : "fiches"}</p>
    <ul className="card divide-y divide-[var(--color-border)] px-4">
      {rows.map(row => <li key={row.id} className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-3">
        <span className="font-semibold">{row.label}
          {row.label !== row.canonicalLabel && <small className="ml-2 font-normal text-[var(--color-muted)]">{row.canonicalLabel}</small>}
        </span>
        <span className="text-sm text-[var(--color-muted)]" data-badge-policy={row.policy}>
          {policyLabels[row.policy]}
          {row.kind === "unknown" && generation ? " · Identité à confirmer" : ""}
        </span>
      </li>)}
    </ul>
  </section>;
}
