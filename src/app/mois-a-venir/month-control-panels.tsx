import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { MonthScenario } from "@/server/phase2/month-scenario";
import type { MonthControlCenterModel } from "@/server/phase2/month-control-center";
import { MonthUpdateControls, type MonthUpdateData } from "./month-control-update";
import { PreserveForecastButton } from "./month-decision-tools";
import { controlDate, controlObligationLabel } from "@/domain/phase2/month-control-display";
import material from "./month-material.module.css";
const money = (value: string | null) => value === null ? "À confirmer" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));

/** Compact serializable inputs from existing owners, with no recomputed financial totals. */
export function MonthUpdatePanel({ forecast, scenario, model }: { forecast: MonthForecastSnapshot; scenario: MonthScenario; model: MonthControlCenterModel; today?: string }) {
  const inputs = scenario.inputs, plan = scenario.economicPlan;
  const resources = plan?.resources.filter(row => row.pocket === "BANK_CASH") ?? forecast.income.components.filter(row => row.central !== null).map(row => ({ key: row.key, label: row.label, amount: inputs.resourceOverrides[row.key] ?? row.central!, sourceAmount: row.central, provenance: inputs.resourceOverrides[row.key] !== undefined ? "MONTH_OVERRIDE" : "SNAPSHOT" }));
  const data: MonthUpdateData = { resources,
    obligations: forecast.components.filter(row => row.key.startsWith("obligation:") && (row.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/iu.test(row.label) || row.nature === "CONTRACTUAL_EXPECTED" && row.additiveGroup === "obligations" && row.central !== null)).map(row => ({ key: row.key, label: controlObligationLabel(row.label), amount: row.central, conditional: row.knowledgeState === "CONDITIONAL_UNKNOWN" })),
    inputs: { openingBalance: inputs.openingBalance, resourceOverrides: inputs.resourceOverrides, confirmedObligations: inputs.confirmedObligations, declinedConditionalObligations: inputs.declinedConditionalObligations, excludedFixedObligations: inputs.excludedFixedObligations, fixedAmountOverrides: inputs.fixedAmountOverrides }, bank: plan?.bankCash ?? null, funding: plan?.plannedFunding ?? null };
  return <MonthUpdateControls model={model} data={data} />;
}

export function MonthReliabilityPanel({ model }: { model: MonthControlCenterModel }) {
  const reliability = model.reliability;
  const economicReasons = model.rootCauses.filter(row => row.scopes.includes("ECONOMIC_MONTH") && row.priority !== "INFORMATIONAL");
  const bankMissing = model.rootCauses.some(row => row.key === "bank-balance"), cards = model.rootCauses.filter(row => row.key.startsWith("wallet:"));
  return <div className="space-y-6"><header><h2 className="text-2xl font-black">Comprendre</h2><p className="mt-2 max-w-prose text-sm text-slate-600">Ce que les données permettent d’estimer, et ce qui reste à préciser.</p></header>
    <section data-control-focus="imports"><h3 className="font-bold">Dépenses du mois</h3><p className="mt-2 text-sm"><strong>{model.scopedReliability.economic === "USABLE" ? "Exploitable" : "À consolider"}</strong>{economicReasons.length > 0 && ` — ${economicReasons.map(row => row.label.toLocaleLowerCase("fr-FR")).join(" · ")}`}</p>
      {reliability.importsMissing && <p className="mt-2 max-w-prose text-sm text-slate-600">Les imports récents sont incomplets. Les habitudes connues complètent donc le mois.</p>}<p className="mt-2 text-sm text-slate-600">Prévision calculée le {controlDate(reliability.computedAt, true)}.</p><a className="mt-2 inline-block text-sm font-bold text-violet-900 underline" href="/imports">Voir les imports</a></section>
    <section><h3 className="font-bold">Banque</h3><p className="mt-2 text-sm">{model.scopedReliability.bank === "USABLE" ? "Exploitable avec le solde daté renseigné." : bankMissing ? "À préciser — solde actuel absent ou insuffisamment daté." : "À préciser — certains paiements ou financements restent inconnus."}</p></section>
    <section><h3 className="font-bold">Swile & Edenred</h3><p className="mt-2 text-sm">{cards.length ? `${cards.map(row => row.label).join(" · ")}. Les soldes et chargements sont distincts.` : "Les informations des cartes permettent d’estimer le financement des repas."}</p>{cards.length > 0 && <ul className="mt-2 space-y-1 text-sm text-slate-600">{cards.map(row => <li key={row.key}>{row.key === "wallet:SWILE" ? "Swile" : "Edenred"} : {row.symptoms.map(value => value.replace("Stock actuel à confirmer", "Solde actuel à renseigner").replace("Propriétaire canonique non résolu", "Titulaire de la carte à confirmer")).join(" · ")}</li>)}</ul>}</section>
    <section className={`${material.glassSoft} p-4`}><h3 className="font-bold">Comment la prévision fonctionne</h3><p className="mt-2 text-sm font-semibold">{reliability.modeLabel}</p><p className="mt-1 max-w-prose text-sm text-slate-600">{reliability.modeExplanation}</p></section>
    <details data-control-focus="history" className="text-sm"><summary className="cursor-pointer font-bold">Historique des estimations</summary>
      {reliability.checkpoints.length ? <><ul className="mt-3 space-y-1">{reliability.checkpoints.map((row, index) => <li key={`${row.date}:${index}`}>{controlDate(row.date, true)} · ≈ {money(row.central)}</li>)}</ul>
        {reliability.change && <ul className="mt-3 space-y-1">{reliability.change.visibleChanges.map(row => <li key={row.key}>{row.label} · {money(String(row.visible))}</li>)}</ul>}</>
        : <p className="mt-3 text-slate-600">Aucune estimation comparable conservée pour ce mois.</p>}
      <p className="mt-3 text-slate-600">{reliability.calibrationAvailable ? "Les mois terminés suffisamment documentés permettent d’ajuster les estimations selon la méthode existante." : "Les références historiques restent utilisées ; le recul personnel n’est pas encore suffisant pour les ajuster."}</p><PreserveForecastButton targetMonth={model.targetMonth} />
    </details><a className="inline-block text-sm text-slate-500 underline" href="/diagnostic">Détails techniques</a>
  </div>;
}
