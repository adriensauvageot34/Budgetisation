import type { RemainingCategory } from "@/server/phase2/remaining-month-forecast";
import type { MonthDecisionProjection } from "@/server/phase2/month-decision-projection";
import type { ReactNode } from "react";
import { AnimatedMoney } from "./animated-money";
import material from "./month-material.module.css";

const money = (value: string | number | null) => value === null ? "À affiner" : new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(Number(value));

/** Explanations stay opt-in, with a keyboard-accessible disclosure. */
export function ForecastInfo({ label, children }: { label: string; children: ReactNode }) {
  return <details className={`${material.disclosure} relative shrink-0 text-xs text-slate-600`}>
    <summary aria-label={label} className={`${material.iconButton} !rounded-full flex size-7 cursor-pointer list-none text-base [&::-webkit-details-marker]:hidden`}>ⓘ</summary>
    <div className={`${material.popover} absolute right-0 top-10 z-30 w-80 space-y-2 p-4 leading-relaxed`}>{children}</div>
  </details>;
}

export function ScenarioMilestone({ title, values, description, final = false }: {
  title: string; values: { lowConsumption: string; central: string; highConsumption: string }; description: string; final?: boolean;
}) {
  return <section id={final ? "final-projection" : "essential-projection"} aria-label={title}
    className={`${material.glassPrimary} ${final ? material.projection : material.tintedBlue} scroll-mt-24 p-6`}>
    <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black">{title}</h2>
      <ForecastInfo label={`Comprendre : ${title}`}><p>{description}</p><p>Estimation économique du mois, distincte d’un solde bancaire.</p></ForecastInfo></div>
    <dl className="mt-4 grid grid-cols-3 items-end gap-5">{([values.lowConsumption, values.central, values.highConsumption] as const).map((value, index) =>
      <div key={index} className={index === 1 ? `${material.centralScenario} px-4 py-3` : "py-3"}>
        <dt className={`text-sm ${index === 1 ? "font-bold text-emerald-900" : "text-slate-500"}`}>{["Mois calme", "Habituel", "Mois plus coûteux"][index]}</dt>
        <dd className={`${material.data} mt-2 whitespace-nowrap ${index === 1 ? "text-4xl font-black" : "text-2xl font-semibold text-slate-600"}`}>≈ <AnimatedMoney value={money(value)} /></dd>
      </div>)}</dl>
  </section>;
}

export function RemainingForecastCard({ category, optional = false, importsMissing = false, display }: {
  category: RemainingCategory; optional?: boolean; importsMissing?: boolean;
  display: MonthDecisionProjection["visible"]["categoryDisplay"][string];
}) {
  return <article className={`${material.dataCard} min-w-0 p-5`}>
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-700">{category.label}</h3>
      <ForecastInfo label={`Comprendre l’estimation : ${category.label}`}>
        <p>{category.explanation}</p><p>{category.observationCount} observations sur {category.evidenceMonths} mois.
          {category.confidence === "LOW" && " Le recul disponible reste limité."}</p>
        {importsMissing && <p>Les données importées ne couvrent pas toute la période écoulée ; les habitudes historiques complètent l’estimation.</p>}
        <p>Une réalisation déclarée est présentée avec l’observé ; elle reste prospective et ne crée aucun débit historique.</p>
        {optional && <p>Projection du mois : observé {money(display.observed)}, prévu {money(display.planned)}, encore estimé {money(display.remaining.central)}.</p>}
        <p>Fourchette du mois : {money(category.projectedMonth.low)} à {money(category.projectedMonth.high)}.</p>
      </ForecastInfo></div>
    <p className={`${material.data} mt-3 text-3xl font-black`}>{optional && <span className="mr-2 text-sm font-medium text-slate-500">Probable</span>}<AnimatedMoney value={money(display.projectedCentral)} /></p>
    {!optional && <dl className="mt-4 space-y-2 text-sm">{([
      ["Déjà observé", display.observed], ["Prévu", display.planned], ["Encore estimé", display.remaining.central],
    ] as const).map(([label, value]) => <div className="flex justify-between gap-3" key={label}><dt className="text-slate-500">{label}</dt><dd className={`${material.data} font-semibold`}><AnimatedMoney value={money(value)} /></dd></div>)}</dl>}
  </article>;
}
