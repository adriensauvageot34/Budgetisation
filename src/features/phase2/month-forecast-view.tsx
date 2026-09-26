import type { ForecastComponent, ForecastRange } from "@/server/phase2/month-forecast";
import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";

const currency = (value: string | null): string => value === null
  ? "Inconnu"
  : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
const monthLabel = (value: string): string => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
const dateLabel = (value: string): string => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
const certainty = (component: ForecastComponent): string => component.knowledgeState === "UNKNOWN" || component.knowledgeState === "CONDITIONAL_UNKNOWN"
  ? "À confirmer"
  : component.nature === "CONTRACTUAL_EXPECTED" ? "Engagé / très probable"
    : component.confidence === "LOW" ? "Estimé" : "Habituel";
const reason = (code: string): string => ({
  FUTURE_EVENTS_UNDECLARED: "Les événements à venir n'ont pas encore été saisis.",
  ORNIKAR_ALMA_TARGET_OCCURRENCE_UNPROVEN: "L'échéance Ornikar / Alma du mois reste à confirmer.",
  BENEFIT_BALANCE_UNKNOWN: "Le solde actuel des titres restaurant n'est pas connu.",
  OPENING_BALANCE_UNKNOWN: "Le solde d'ouverture manque pour calculer le disponible immédiat.",
  M3_REGIME_NOT_PUBLISHED: "Le changement de rythme récent n'est pas encore certifié.",
  ECONOMIC_BASE_EXCLUDES_UNKNOWN_EVENTS_AND_CONDITIONAL_OBLIGATIONS: "Le socle affiché exclut les événements inconnus et les échéances conditionnelles.",
  SIX_MONTHS_LOWER_BOUND: "Certains mois Food sont des minimums observés.",
  M1_EXPECTED_AMOUNT_UNKNOWN: "Montant appuyé sur une opération récente ; prochaine échéance non confirmée.",
  TARGET_MONTH_OCCURRENCE_NOT_PROVEN: "Aucune occurrence du mois cible n'est prouvée.",
  PHYSICAL_USAGE_ESTIMATE: "Estimation de carburant consommé, distincte du carburant payé.",
}[code] ?? "Estimation issue des données disponibles ; à confirmer.");

function Evidence({ component }: { component: ForecastComponent }) {
  return <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer font-semibold text-slate-600">Pourquoi ce montant ?</summary>
    <p className="mt-2">Référence : {component.referenceMode.toLowerCase().replaceAll("_", " ")} · données jusqu’au {component.freshnessDate ? dateLabel(component.freshnessDate) : "date inconnue"}.</p>
    {component.limitations.length > 0 && <p className="mt-1">{component.limitations.map(reason).join(" ")}</p>}
    <p className="mt-1 break-all">Sources : {component.provenance.join(" · ") || "Inconnues"}</p>
  </details>;
}

function Figure({ label, value, note, prominent = false }: { label: string; value: string | null; note?: string; prominent?: boolean }) {
  return <div className={prominent ? "rounded-2xl bg-white/15 p-5" : "rounded-2xl border border-slate-200 bg-white p-4"}>
    <p className={prominent ? "text-sm font-semibold text-white/80" : "text-sm font-semibold text-slate-500"}>{label}</p>
    <p className={prominent ? "mt-1 text-4xl font-black tracking-tight text-white sm:text-5xl" : "mt-1 text-2xl font-bold tracking-tight text-slate-900"}>{currency(value)}</p>
    {note && <p className={prominent ? "mt-2 text-xs text-white/75" : "mt-2 text-xs text-slate-500"}>{note}</p>}
  </div>;
}

function Scenario({ label, range, field, active = false }: { label: string; range: ForecastRange; field: keyof ForecastRange; active?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${active ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white"}`}>
    <p className="text-sm font-bold text-slate-600">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{currency(range[field])}</p>
  </div>;
}

const lifeKeys = ["food", "health", "personal-care", "tobacco-vape", "work-coffee", "animal-care"] as const;

export function MonthForecastView({ forecast }: { forecast: MonthForecastSnapshot }) {
  const obligations = forecast.components.filter((component) => component.key.startsWith("obligation:"));
  const life = lifeKeys.map((key) => forecast.components.find((component) => component.key === key)).filter((component): component is ForecastComponent => component !== undefined);
  const mobility = forecast.components.find((component) => component.key === "mobility-usage");
  return <div className="mx-auto max-w-5xl space-y-6 pb-16">
    <header className="space-y-3">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-700">Phase 2 · Notre mois à venir</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">{monthLabel(forecast.meta.targetMonth)}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Une prévision de votre socle connu, avec ses incertitudes visibles.</p></div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">{forecast.meta.certificationStatus === "PROVISIONAL" ? "Prévision provisoire" : forecast.meta.certificationStatus}</span>
      </div>
      <p className="text-xs text-slate-500">Calculé le {dateLabel(forecast.meta.computedAt)} · Publication {forecast.meta.sourcePublicationId.slice(0, 8)} · Révision {forecast.meta.analyticsRevision}</p>
    </header>

    <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-emerald-800 p-5 text-white shadow-xl sm:p-8" aria-labelledby="forecast-summary">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Scénario central · probable</p>
      <h2 id="forecast-summary" className="mt-1 text-xl font-bold">Ce qui reste à répartir ce mois</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr]"><Figure label="FreeToSpend" value={forecast.freeToSpend.central} prominent note="Après le socle économique et la réserve de sécurité. Hors événements encore inconnus." />
        <Figure label="Revenus attendus" value={forecast.income.central} note="Probable, pas encore encaissé." /><Figure label="Socle central" value={forecast.economicCost.central} note="Consommation économique connue." /></div>
      <p className="mt-4 text-sm text-white/80">Réserve de sécurité : <strong>{currency(forecast.reserve.amount)}</strong> · Disponible maintenant : <strong>{forecast.availableNow.status === "UNAVAILABLE" ? "indisponible sans solde d’ouverture" : currency(forecast.availableNow.value)}</strong></p>
    </section>

    <section className="card p-5 sm:p-7" aria-labelledby="forecast-scenarios"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="forecast-scenarios" className="text-xl font-black">Trois scénarios</h2><span className="text-xs font-semibold text-slate-500">FreeToSpend mensuel · socle connu</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Scenario label="Prudent" range={forecast.freeToSpend} field="low" /><Scenario label="Central" range={forecast.freeToSpend} field="central" active /><Scenario label="Favorable" range={forecast.freeToSpend} field="high" /></div>
      <p className="mt-4 text-sm text-slate-600">L’amplitude vient des revenus probables et des dépenses habituelles observées. Les événements non déclarés et les échéances conditionnelles restent inconnus.</p>
      <details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer font-semibold">Voir le socle économique bas / central / haut</summary><p className="mt-2">{currency(forecast.economicCost.low)} · {currency(forecast.economicCost.central)} · {currency(forecast.economicCost.high)}</p></details>
    </section>

    <section className="card p-5 sm:p-7" aria-labelledby="forecast-obligations"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="forecast-obligations" className="text-xl font-black">Calendrier des obligations</h2><span className="text-sm font-bold text-emerald-800">{currency(forecast.obligations.central)} · Engagé / très probable</span></div>
      <p className="mt-2 text-sm text-slate-600">Échéances mensuelles attendues. Leur jour précis en {monthLabel(forecast.meta.targetMonth)} reste à confirmer.</p>
      <details className="mt-4 rounded-2xl bg-slate-50 p-4"><summary className="cursor-pointer font-bold text-slate-800">Voir les obligations et leur statut</summary>
        <ul className="mt-4 divide-y divide-slate-200">{obligations.map((component) => <li key={component.key} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{component.label}</p><p className="text-xs text-slate-500">Jour à confirmer · {certainty(component)}</p><Evidence component={component} /></div><strong className="whitespace-nowrap">{currency(component.central)}</strong></li>)}</ul>
      </details>
    </section>

    <section className="card p-5 sm:p-7" aria-labelledby="forecast-life"><h2 id="forecast-life" className="text-xl font-black">Vie courante</h2><p className="mt-1 text-sm text-slate-600">Enveloppes habituelles, sans additionner les sous-postes à leurs parents.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{life.map((component) => { const children = forecast.components.filter((child) => child.parentEnvelope === component.key); return <article key={component.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-bold text-slate-700">{component.label === "Food" ? "Alimentation & sorties" : component.label}</p><p className="mt-1 text-2xl font-black text-slate-950">{currency(component.central)}</p><p className="mt-1 text-xs font-semibold text-emerald-800">{certainty(component)} · {currency(component.low)} à {currency(component.high)}</p>
        <details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Sous-postes</summary>{children.length ? <ul className="mt-2 space-y-1">{children.map((child) => <li key={child.key}>{child.label} · {currency(child.central)}</li>)}</ul> : <p className="mt-2">Aucun sous-poste chiffré dans cette prévision.</p>}</details><Evidence component={component} /></article>; })}</div>
    </section>

    <div className="grid gap-6 lg:grid-cols-2"><section className="card p-5 sm:p-7" aria-labelledby="forecast-mobility"><h2 id="forecast-mobility" className="text-xl font-black">Mobilité</h2><p className="mt-1 text-sm text-slate-600">Le carburant consommé et le carburant payé sont deux lectures différentes.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><Figure label="Usage économique estimé" value={mobility?.central ?? null} note="Inclus dans le socle économique." /><Figure label="Vue cash totale" value={forecast.cash.grossBeforeUnconfirmedFunding.central} note="Inclut une réserve de carburant payé ; son montant isolé n'est pas publié." /></div>{mobility && <Evidence component={mobility} />}</section>
      <section className="card p-5 sm:p-7" aria-labelledby="forecast-funding"><h2 id="forecast-funding" className="text-xl font-black">Funding · Benefit</h2><p className="mt-1 text-sm text-slate-600">Le financement ne réduit pas la consommation économique.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Figure label="Benefit probable" value={forecast.funding.benefitHistoricalRange.central} note="Repère historique, non confirmé pour ce mois." /><Figure label="Benefit confirmé" value={forecast.cash.confirmedBenefit} note="Solde du wallet inconnu." /></div><p className="mt-4 text-sm text-slate-700">Besoin cash avant Benefit : <strong>{currency(forecast.cash.grossBeforeUnconfirmedFunding.central)}</strong></p><p className="mt-1 text-sm text-slate-700">Si le financement historique se confirme : <strong>{currency(forecast.cash.afterPotentialBenefit.central)}</strong> hors Benefit.</p></section></div>

    <div className="grid gap-6 lg:grid-cols-2"><section className="card p-5 sm:p-7" aria-labelledby="forecast-events"><h2 id="forecast-events" className="text-xl font-black">Événements</h2><p className="mt-3 text-sm text-slate-700">Prévu par vous : {forecast.events.planned.length === 0 ? "aucun événement enregistré pour ce mois." : `${forecast.events.planned.length} événement(s).`}</p><p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Delta financier : {forecast.events.eventDelta === null ? "Inconnu" : currency(forecast.events.eventDelta)}</p><p className="mt-2 text-xs text-slate-500">Un événement futur non déclaré ne vaut pas zéro.</p></section>
      <section className="card p-5 sm:p-7" aria-labelledby="forecast-confirm"><h2 id="forecast-confirm" className="text-xl font-black">À confirmer</h2><ul className="mt-3 space-y-2 text-sm text-slate-700"><li>Ornikar / Alma : échéance du mois non prouvée.</li><li>Benefit / Swile : financement et solde actuel à vérifier.</li><li>Données récentes : août et septembre ne figurent pas encore dans les références publiées.</li><li>Solde d’ouverture : nécessaire pour connaître le disponible maintenant.</li></ul></section></div>

    <section className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50/60 p-5 sm:p-7" aria-labelledby="forecast-what-if"><span className="text-xs font-bold uppercase tracking-widest text-emerald-700">Prochainement</span><h2 id="forecast-what-if" className="mt-2 text-xl font-black">Et si on changeait le mois ?</h2><p className="mt-2 text-sm text-slate-600">Espace réservé aux essais visuels. Aucun scénario personnel n’est enregistré ici pour le moment.</p></section>
  </div>;
}
