import { getBudgetRepository } from "@/data";
import { ImportTrigger } from "@/features/imports/import-trigger";
import { DataQualityCenter } from "@/features/data-quality/data-quality-center";
import { formatMonth, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ complete?: string }>;
}) {
  const query = await searchParams;
  const repository = await getBudgetRepository();
  const [months, operations, batches, categories] = await Promise.all([
    repository.getMonths(),
    repository.getOperations(),
    repository.getImportBatches(),
    repository.getCategories(),
  ]);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentOperationCount = operations.filter(
    (operation) => operation.importMonth === currentMonth,
  ).length;
  const latestBatch = batches[0];
  const latestAvailableMonth = months.at(-1);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <div className="mb-5 flex flex-wrap gap-3">
          <ImportTrigger />
          <DataQualityCenter
            operations={operations}
            categories={categories}
            initialOpen={query.complete === "1"}
          />
        </div>
        <p className="eyebrow mb-2">Mois en cours</p>
        <h1 className="text-[clamp(2rem,4vw,3.2rem)] font-black leading-none tracking-[-0.05em]">
          Bonjour Adrien et Manon
        </h1>
        <p className="mt-3 text-[var(--color-muted)]">
          Cet espace accueillera la gestion du présent. Les analyses des mois
          passés sont maintenant regroupées dans Historique.
        </p>
      </header>

      <section className="card overflow-hidden">
        <div className="grid sm:grid-cols-3">
          <div className="bg-[var(--color-primary)] p-6 text-white">
            <p className="text-sm font-bold text-white/70">Mois actuel</p>
            <p className="mt-2 text-2xl font-black capitalize">
              {titleCase(formatMonth(currentMonth))}
            </p>
          </div>
          <div className="border-b border-[var(--color-border)] p-6 sm:border-b-0 sm:border-r">
            <p className="text-sm font-bold text-[var(--color-muted)]">
              Opérations du mois
            </p>
            <p className="mt-2 text-2xl font-black">{currentOperationCount}</p>
          </div>
          <div className="p-6">
            <p className="text-sm font-bold text-[var(--color-muted)]">
              Dernières données disponibles
            </p>
            <p className="mt-2 text-lg font-black capitalize">
              {latestAvailableMonth
                ? titleCase(formatMonth(latestAvailableMonth))
                : "Aucune donnée"}
            </p>
            {latestBatch ? (
              <p className="mt-1 truncate text-xs text-[var(--color-muted)]">
                Dernier import : {latestBatch.filename} ·{" "}
                {new Intl.DateTimeFormat("fr-FR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }).format(new Date(latestBatch.importedAt))}
              </p>
            ) : null}
          </div>
        </div>
      </section>

    </div>
  );
}

