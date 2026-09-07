import type { Metadata } from "next";
import { GlobalV2ActivationPending, GlobalV2Page, createGlobalV2FixtureBundle, type GlobalV2FixtureScenario } from "@/features/global-v2";

export const metadata: Metadata = { title: "Analyse globale V2" };
export const dynamic = "force-dynamic";

export default async function GlobalV2Route({ searchParams }: { readonly searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>> }) {
  const params = await searchParams;
  const rawScenario = Array.isArray(params.fixture) ? params.fixture[0] : params.fixture;
  const scenario: GlobalV2FixtureScenario = rawScenario === "local-error" || rawScenario === "new-generation" ? rawScenario : "contract";
  if (process.env.NODE_ENV === "production") return <GlobalV2ActivationPending />;
  return <GlobalV2Page bundle={createGlobalV2FixtureBundle(scenario)} scenario={scenario} />;
}
