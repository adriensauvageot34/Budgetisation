import { redirect } from "next/navigation";
import { getBootstrapContext } from "@/server/bootstrap/context";
import {
  AmbiguousHouseholdError,
  BootstrapAuthenticationRequiredError,
} from "@/server/bootstrap/errors";

export const metadata = { title: "Diagnostic technique" };
export const dynamic = "force-dynamic";

export default async function DiagnosticPage() {
  let context: Awaited<ReturnType<typeof getBootstrapContext>>;
  try {
    context = await getBootstrapContext();
  } catch (error) {
    if (error instanceof BootstrapAuthenticationRequiredError) redirect("/connexion");
    if (error instanceof AmbiguousHouseholdError) {
      return <section className="card p-8"><span className="eyebrow">Diagnostic V2</span><h1>Contexte Household ambigu</h1><p>{error.message}</p></section>;
    }
    throw error;
  }
  if (context.household === null) redirect("/acces-refuse");
  return (
    <div className="space-y-6" data-product-surface="diagnostic">
      <header><span className="eyebrow">Route secondaire</span><h1 className="mt-3 text-4xl font-black">Diagnostic technique V2</h1><p className="muted">Auth, RLS et contexte de révision — sans écriture distante.</p></header>
      <section className="card grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3">
        <div><span className="eyebrow">Household</span><p className="text-xl font-black">{context.household.name}</p></div>
        <div><span className="eyebrow">Timezone</span><p className="text-xl font-black">{context.household.timezone}</p></div>
        <div><span className="eyebrow">Persons</span><p className="text-xl font-black">{context.persons.map((person) => person.displayName).join(", ") || "Aucune"}</p></div>
        <div><span className="eyebrow">Analysis periods</span><p className="text-xl font-black">{context.periods.length}</p></div>
        <div><span className="eyebrow">DataRevision</span><p className="text-xl font-black">{context.revision?.dataRevision ?? "—"}</p></div>
        <div><span className="eyebrow">AnalyticsRevision</span><p className="text-xl font-black">{context.revision?.analyticsRevision ?? "—"}</p></div>
      </section>
    </div>
  );
}
