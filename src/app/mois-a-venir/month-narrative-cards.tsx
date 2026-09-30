import type { RemainingCategory } from "@/server/phase2/remaining-month-forecast";

const money = (value: string | null) => value === null ? "À affiner" : new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));

export function ScenarioMilestone({ title, values, labels, description, incomplete = false, final = false }: {
  title: string; values: { lowConsumption: string; central: string; highConsumption: string };
  labels: readonly [string, string, string]; description: string; incomplete?: boolean; final?: boolean }) {
  return <section aria-label={title} className={`rounded-2xl p-6 ${final ? "bg-emerald-950 text-white" : "border border-emerald-100 bg-emerald-50/70"}`}>
    <h2 className="text-2xl font-black">{title}</h2><p className={`mt-1 text-sm ${final ? "text-emerald-100" : "text-slate-600"}`}>{description}</p>
    <dl className="mt-5 grid grid-cols-3 items-end gap-5">{([values.lowConsumption, values.central, values.highConsumption] as const).map((value, index) =>
      <div key={labels[index]} className={index === 1 ? "rounded-xl bg-white/10 px-4 py-3" : "py-3"}>
        <dt className={`text-sm ${index === 1 ? "font-bold" : "opacity-75"}`}>{labels[index]}</dt>
        <dd className={`mt-2 whitespace-nowrap tabular-nums ${index === 1 ? "text-4xl font-black" : "text-2xl font-semibold"}`}>{money(incomplete ? null : value)}</dd>
      </div>)}</dl>
    {incomplete && <p className="mt-3 text-sm">Les dépenses de ce mois ne sont pas encore importées. Les estimations du reste du mois sont visibles ci-dessus ; la projection complète sera affinée avec ces imports.</p>}
    {final && <p className="mt-3 text-xs text-emerald-100">Repères économiques, pas un solde bancaire ni une autorisation de dépenser. La marge de sécurité n’est pas encore retirée.</p>}
  </section>;
}

export function RemainingForecastCard({ category, optional = false, importsMissing = false }: {
  category: RemainingCategory; optional?: boolean; importsMissing?: boolean }) {
  return <article className={`min-w-0 rounded-2xl p-5 ${optional ? "bg-slate-50/80" : "bg-white ring-1 ring-slate-100"}`}>
    <h3 className="text-sm font-bold text-slate-700">{category.label}</h3>
    <p className="mt-1 text-xs text-slate-500">{optional ? "Pourrait encore arriver" : "Encore estimé jusqu’à la fin du mois"}</p>
    <dl className="mt-4 grid grid-cols-3 items-end gap-2">{([
      [optional ? "Calme" : "Bas plausible", category.remaining.low],
      [optional ? "Probable" : "Habituel", category.remaining.central],
      [optional ? "Actif" : "Haut plausible", category.remaining.high],
    ] as const).map(([label, value], index) => <div key={label}>
      <dt className={`text-xs ${index === 1 ? "font-bold text-emerald-900" : "text-slate-500"}`}>{label}</dt>
      <dd className={`mt-1 whitespace-nowrap tabular-nums ${index === 1 ? "text-2xl font-black text-emerald-950" : "text-sm font-semibold text-slate-600"}`}>{money(value)}</dd>
    </div>)}</dl>
    {optional && category.expectedOccurrences && <p className="mt-3 text-xs text-slate-600">0 à {Math.ceil(category.expectedOccurrences.high)} {category.key === "household-restaurants" ? "sortie(s)" : "achat(s)"} encore possibles.</p>}
    {category.plannedOccurrencesAbsorbingHabit > 0 && <p className="mt-2 text-xs text-sky-800">{category.plannedOccurrencesAbsorbingHabit} projet(s) déjà compris dans les habitudes du mois.</p>}
    {category.plannedOccurrencesExtra > 0 && <p className="mt-1 text-xs text-sky-800">{category.plannedOccurrencesExtra} projet(s) en plus.</p>}
    {category.confidence === "LOW" && <p className="mt-2 text-xs text-slate-500">Estimation prudente · peu de recul comparable</p>}
    <details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-emerald-900">Pourquoi ?</summary>
      <p className="mt-2">{category.explanation}</p>
      <dl className="mt-3 space-y-1"><div className="flex justify-between gap-2"><dt>Déjà importé ce mois</dt><dd>{importsMissing ? "Pas encore importé" : money(category.alreadyRealized)}</dd></div>
        <div className="flex justify-between gap-2"><dt>Projets habituels, coût brut</dt><dd>{money(category.habitualProjectGross)}</dd></div>
        <div className="flex justify-between gap-2"><dt>Projection du mois</dt><dd>{importsMissing ? "À affiner" : `${money(category.projectedMonth.low)} à ${money(category.projectedMonth.high)}`}</dd></div>
        {category.probability !== null && <div className="flex justify-between gap-2"><dt>Achat sur les jours comparables</dt><dd>Environ {new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 }).format(category.probability)}</dd></div>}
        {category.conditionalMedianAmount !== null && <div className="flex justify-between gap-2"><dt>Coût habituel lorsque cela arrive</dt><dd>{money(category.conditionalMedianAmount)}</dd></div>}
      </dl><p className="mt-2">{category.observationCount} observations comparables. Les projets marqués réalisés restent prospectifs ; aucun débit historique n’est créé.</p>
    </details>
  </article>;
}
