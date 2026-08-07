import type { Metadata } from "next";
import {
  ArrowDownUp,
  ChevronDown,
  CircleGauge,
  ListTree,
  Settings2,
  Tags,
} from "lucide-react";
import { budgetRepository } from "@/data";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Paramètres",
};

const flows = [
  ["Dépense", "Comptée dans la consommation si le montant est débiteur."],
  ["Revenu", "Compté dans les revenus du foyer."],
  ["Remboursement", "Ajuste le résultat net sans devenir un revenu."],
  ["Transfert interne", "Exclu des dépenses et des revenus."],
  ["Prêt et avance", "Suivi séparément, sans effet sur la consommation."],
  ["Flux technique", "Exclu tant que sa destination n’est pas clarifiée."],
];

const importance = [
  ["Indispensable", "#52766f", "Difficile à réduire sans impact direct."],
  ["Contrainte", "#d69a3c", "À suivre, mais avec une marge limitée."],
  ["Ajustable", "#d36e53", "Peut être modulé selon le contexte."],
  ["Optionnelle", "#806da5", "Premier levier de réduction si nécessaire."],
];

export default function SettingsPage() {
  const categories = budgetRepository.getCategories();

  return (
    <div>
      <PageHeader
        eyebrow="Structure de classement"
        title="Paramètres"
        description="Consultez la taxonomie et les règles qui donnent du sens aux opérations. L’édition complète viendra plus tard."
        action={
          <span className="badge">
            <Settings2 size={14} />
            Mode consultatif
          </span>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--color-border)] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <ListTree size={20} />
              </span>
              <div>
                <p className="eyebrow mb-1">Hiérarchie</p>
                <h2 className="text-xl font-black">Catégories et sous-catégories</h2>
              </div>
            </div>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {categories.map((category) => (
              <details key={category.slug} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition hover:bg-[#fafaf7] sm:px-6">
                  <span
                    className="size-3 rounded-full"
                    style={{ background: category.color }}
                  />
                  <span className="min-w-0 flex-1 font-extrabold">
                    {category.name}
                  </span>
                  <span
                    className="badge"
                    data-tone={
                      category.includedInConsumption ? "positive" : undefined
                    }
                  >
                    {category.includedInConsumption
                      ? "Incluse"
                      : "Flux séparé"}
                  </span>
                  <ChevronDown
                    size={17}
                    className="text-[var(--color-muted)] transition group-open:rotate-180"
                  />
                </summary>
                <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-soft)] px-5 py-4 sm:px-11">
                  <div className="flex flex-wrap gap-2">
                    {category.subcategories.map((subcategory) => (
                      <span key={subcategory} className="badge bg-white">
                        {subcategory}
                      </span>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <section className="card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <CircleGauge size={20} />
              </span>
              <div>
                <p className="eyebrow mb-1">Arbitrage</p>
                <h2 className="text-xl font-black">Niveaux d’importance</h2>
              </div>
            </div>
            <div className="space-y-3">
              {importance.map(([label, color, description]) => (
                <div
                  key={label}
                  className="rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-4"
                >
                  <p className="flex items-center gap-2 font-extrabold">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: color }}
                    />
                    {label}
                  </p>
                  <p className="mt-1.5 text-sm leading-5 text-[var(--color-muted)]">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#ece7f2] text-[#7566a5]">
                <Tags size={20} />
              </span>
              <div>
                <p className="eyebrow mb-1">Analyse</p>
                <h2 className="text-xl font-black">Statuts analytiques</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="badge" data-tone="positive">
                Habituel
              </span>
              <span className="badge" data-tone="warning">
                Exceptionnel
              </span>
              <span className="badge" data-tone="negative">
                Hors budget
              </span>
              <span className="badge" data-tone="warning">
                À ventiler
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
              Ces statuts n’effacent jamais une opération. Ils permettent de
              distinguer le rythme ordinaire des événements atypiques.
            </p>
          </section>
        </div>
      </section>

      <section className="card mt-5 overflow-hidden">
        <div className="border-b border-[var(--color-border)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#e2edf2] text-[#5b8eaa]">
              <ArrowDownUp size={20} />
            </span>
            <div>
              <p className="eyebrow mb-1">Règles de calcul</p>
              <h2 className="text-xl font-black">Types de flux et inclusion</h2>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th>Type de flux</th>
                <th>Règle appliquée</th>
                <th>Nature disponible</th>
              </tr>
            </thead>
            <tbody>
              {flows.map(([label, rule]) => (
                <tr key={label}>
                  <td className="font-extrabold">{label}</td>
                  <td>{rule}</td>
                  <td>{label === "Dépense" ? "Fixe ou variable" : "Séparée"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
