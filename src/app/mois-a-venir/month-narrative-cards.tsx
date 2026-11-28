import type { RemainingCategory } from "@/server/phase2/remaining-month-forecast";
import type { MonthDecisionProjection } from "@/server/phase2/month-decision-projection";
import type { MonthCategoryControl } from "@/server/phase2/month-category-controls";
import { MonthControlLink } from "./month-control-center";
import { ForecastFacts } from "./forecast-dashboard";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const money = (value: string | number | null) => value === null ? "À affiner" : euros.format(Number(value));

export function RemainingForecastCard({ category, importsMissing = false, display, control }: {
  control?: MonthCategoryControl;
  category: RemainingCategory; importsMissing?: boolean;
  display: MonthDecisionProjection["visible"]["categoryDisplay"][string];
}) {
  const values = [
    ["Déjà observé", display.observed], ["Déclaré réalisé", display.declared],
    ["Prévu explicitement", display.planned], ["En attente d’observation", display.pending],
    [category.method === "CUMULATIVE_CURVE" || category.method === "CADENCE" ? "Encore estimé" : "Encore possible", display.future],
  ] as const;
  return <>
    <ForecastFacts rows={values.filter(([label, value]) => label !== "Déclaré réalisé" || value > 0)
      .map(([label, value]) => [label, money(value)])} />
    {display.counts && <p>{display.counts.observed} jours observés · {display.counts.pending + display.counts.unresolved} en attente · {display.counts.future} encore possibles</p>}
    {category.expectedOccurrences && <p>Environ {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(category.expectedOccurrences.central)} sorties restantes · {category.plannedOccurrencesAbsorbingHabit} déjà prévues dans l’habitude.</p>}
    <p>{category.explanation} {category.observationCount} observations sur {category.evidenceMonths} mois.
      {category.confidence === "LOW" && " Le recul disponible reste limité."}</p>
    <p>Une réalisation déclarée reste distincte d’un débit observé. Elle ne crée aucun historique.</p>
    {importsMissing && <p>Les imports couvrent une partie du mois écoulé. Les habitudes historiques complètent l’estimation.</p>}
    <p>Financement bancaire du reste {money(category.remainingForecastBankCash.central)} · Fourchette exploratoire {money(category.remaining.low)} à {money(category.remaining.high)}.</p>
    {(category.key === "adrien-work-meals" || category.key === "manon-work-meals") && <p>Titres-restaurant prévus · Swile {money(category.expectedFunding.SWILE.central)}, Edenred {money(category.expectedFunding.EDENRED.central)}. À confirmer {money(category.expectedFunding.UNKNOWN?.central ?? null)}.</p>}
    {control && <div className="mt-2">
      {control.target !== null && <p>Votre objectif <strong>{money(control.target)}</strong> · Prévision du mois {money(control.forecast)}
        {control.varianceToTarget !== null && <span> · Écart {money(control.varianceToTarget)}</span>}</p>}
      <MonthControlLink section="choices" focus={control.key} className="font-bold underline">{control.target === null ? "Fixer un repère" : "Piloter cet objectif"}</MonthControlLink>
    </div>}
  </>;
}
