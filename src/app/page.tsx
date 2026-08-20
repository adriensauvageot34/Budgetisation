import { redirect } from "next/navigation";
import { getBootstrapContext } from "@/server/bootstrap/context";
import {
  AmbiguousHouseholdError,
  BootstrapAuthenticationRequiredError,
} from "@/server/bootstrap/errors";

export const dynamic = "force-dynamic";

function AmbiguousHouseholdState({ message }: { message: string }) {
  return (
    <section className="card mx-auto max-w-2xl p-8 text-center">
      <p className="eyebrow">Bootstrap V2 — état ambigu</p>
      <h1 className="mt-2 text-2xl font-black">Contexte Household non déterminé</h1>
      <p className="mt-3 text-[var(--color-muted)]">{message}</p>
    </section>
  );
}

export default async function HomePage() {
  let context: Awaited<ReturnType<typeof getBootstrapContext>>;

  try {
    context = await getBootstrapContext();
  } catch (error) {
    if (error instanceof BootstrapAuthenticationRequiredError) {
      redirect("/connexion");
    }
    if (error instanceof AmbiguousHouseholdError) {
      return <AmbiguousHouseholdState message={error.message} />;
    }
    throw error;
  }

  if (!context.household) redirect("/acces-refuse");

  const firstPeriod = context.periods.at(0)?.month;
  const lastPeriod = context.periods.at(-1)?.month;

  return (
    <div className="space-y-6">
      <header>
        <span className="badge" data-tone="warning">
          Bootstrap V2 — validation technique
        </span>
        <h1 className="mt-3 text-[clamp(2rem,5vw,3.5rem)] font-black tracking-[-0.05em]">
          Connexion Supabase V2
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
          Page provisoire de vérification Auth, RLS et lectures serveur. Elle ne
          constitue pas l’accueil final de Budgetisation V2.
        </p>
      </header>

      <section className="card p-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm font-bold text-[var(--color-muted)]">Household</p>
            <p className="mt-1 text-xl font-black">{context.household.name}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--color-muted)]">Timezone</p>
            <p className="mt-1 text-xl font-black">{context.household.timezone}</p>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--color-muted)]">Persons</p>
            <p className="mt-1 text-xl font-black">
              {context.persons.length
                ? context.persons.map((person) => person.displayName).join(", ")
                : "Aucune"}
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--color-muted)]">
              Analysis Periods
            </p>
            <p className="mt-1 text-xl font-black">{context.periods.length}</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {firstPeriod ?? "—"} → {lastPeriod ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--color-muted)]">data_revision</p>
            <p className="mt-1 text-xl font-black">
              {context.revision?.dataRevision ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--color-muted)]">
              analytics_revision
            </p>
            <p className="mt-1 text-xl font-black">
              {context.revision?.analyticsRevision ?? "—"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
