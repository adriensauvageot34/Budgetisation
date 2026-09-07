import type { Metadata } from "next";
import { GlobalV2ActivationPending, GlobalV2FixturePage, GlobalV2ProductionPage, GlobalV2Unavailable, createGlobalV2FixtureBundle, type GlobalV2FixtureScenario } from "@/features/global-v2";
import { loadGlobalV2ProductionBundle } from "@/server/query/global-v2-production-loader";

export const metadata: Metadata = { title: "Analyse globale V2" };
export const dynamic = "force-dynamic";

export default async function GlobalV2Route({ searchParams }: { readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>> }) {
  const params = await searchParams;
  const rawScenario = Array.isArray(params.fixture) ? params.fixture[0] : params.fixture;
  const scenario: GlobalV2FixtureScenario = rawScenario === "local-error" || rawScenario === "new-generation" ? rawScenario : "contract";
  if (process.env.NODE_ENV === "production") {
    if (process.env.GLOBAL_V2_ROUTE_ACTIVE !== "true") return <GlobalV2ActivationPending />;
    try {
      const loaded = await loadGlobalV2ProductionBundle();
      return <GlobalV2ProductionPage bundle={loaded.bundle} certifiedThrough={loaded.certifiedThrough} />;
    } catch {
      return <GlobalV2Unavailable />;
    }
  }
  const bundle = createGlobalV2FixtureBundle(scenario);
  return <GlobalV2FixturePage bundle={bundle} scenario={scenario} certifiedThrough="2026-07-31" />;
}
