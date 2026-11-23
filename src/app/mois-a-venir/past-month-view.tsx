import type { projectPastMonthReview } from "@/server/phase2/past-month-review";
import { MonthDataStatus } from "./month-data-status";
import type { MonthEntry } from "./month-entry";
import { forecastWindowMonths, monthPlanningHref } from "./month-entry";
import { MonthNavigation } from "./month-navigation";
import material from "./month-material.module.css";
const money = (value: string | null) => value === null ? "Non disponible" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value));
export function PastMonthView({ targetMonth, review, entry, referenceAvailable = true }: {
  targetMonth: string; review: ReturnType<typeof projectPastMonthReview>; entry?: MonthEntry; referenceAvailable?: boolean;
}) {
  return <main className={`${material.page} mx-auto max-w-5xl space-y-6 pb-20 text-slate-900`}>
    <MonthNavigation targetMonth={targetMonth} />
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-black">Notre bilan du mois passé</h2><p className="mt-2 text-slate-600">Prévu, réalisé et écart, à partir des prévisions réellement conservées et des opérations importées.</p></div>
      {referenceAvailable && forecastWindowMonths.includes(targetMonth)
        ? <a className={`${material.clayButton} inline-flex items-center px-4 py-2 text-sm font-bold`} href={monthPlanningHref(targetMonth)}>Voir les prévisions de référence</a>
        : <a className="text-sm font-bold underline" href="/mois-a-venir">Mois courant</a>}
    </header>
    {entry && <MonthDataStatus entry={entry} />}
    {!review.complete && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Couverture des imports incomplète : les montants observés sont partiels. Aucun écart définitif ni erreur de calibration ne peut être validé.</p>}
    <section className="card p-6"><h2 className="text-xl font-black">Nos estimations au fil du mois</h2><div className="mt-4 grid grid-cols-3 gap-4">{review.checkpoints.map(({ horizon, row }) => <div key={horizon}><h3 className="text-sm font-bold">{horizon === "START" ? "Début" : horizon === "MID" ? "Milieu" : "Fin"} du mois</h3><p className="mt-2 text-lg font-black">{row ? money(row.payload.final.central) : "Non conservée"}</p>{row && <p className="mt-1 text-xs text-slate-500">Estimation au {row.as_of_date} · repère économique</p>}</div>)}</div><p className="mt-4 text-xs text-slate-500">Ces chiffres proviennent des prévisions conservées à l’époque. Le résultat bancaire réel se consulte dans l’historique.</p></section>
    <section className="card p-6"><h2 className="text-xl font-black">Prévu / réalisé / écart par catégorie</h2><table className="mt-4 w-full text-sm"><caption className="mb-3 text-left text-xs text-slate-500">Prévu au début du mois, puis coûts canoniques {review.complete ? "réalisés" : "observés partiellement"}. Un écart positif signifie un coût supérieur à la prévision.</caption><thead><tr className="border-b text-left"><th scope="col" className="pb-3">Catégorie</th><th scope="col">Prévu</th><th scope="col">{review.complete ? "Réalisé" : "Observé partiel"}</th><th scope="col">Écart</th></tr></thead><tbody>{review.categories.map(c => <tr key={c.key} className="border-b border-slate-100"><th scope="row" className="py-3 text-left font-semibold">{c.label}</th><td>{c.expected === null ? "Non conservé" : money(c.expected)}</td><td>{money(c.observed)}</td><td>{c.difference === null ? "À affiner" : money(c.difference)}</td></tr>)}</tbody></table><p className="mt-4 text-xs text-slate-600">Total {review.complete ? "réalisé" : "observé"} de ces catégories : {money(review.actualSelectedCategories)}. Ce total n’est pas le reste économique de tout le foyer.</p><a className="mt-4 inline-block font-bold text-emerald-900 underline" href={`/historique/${targetMonth}`}>Voir le bilan historique complet</a></section>
  </main>;
}
