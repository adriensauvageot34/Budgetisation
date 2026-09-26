import type { ForecastComponent, ForecastRange } from "@/server/phase2/month-forecast";
import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { StoredMonthInputs } from "@/server/phase2/month-inputs";
import { REPLACEABLE_ENVELOPES, type MonthScenario } from "@/server/phase2/month-scenario";
import { updateMonthInputs } from "@/app/mois-a-venir/actions";

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

export function MonthForecastView({ forecast, scenario, stored, whatIfError, inputError }: { forecast: MonthForecastSnapshot; scenario: MonthScenario; stored: StoredMonthInputs; whatIfError: boolean; inputError: boolean }) {
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
      <div className="mt-5 grid gap-3 sm:grid-cols-[1.3fr_1fr_1fr]"><Figure label="FreeToSpend" value={scenario.freeToSpend.central} prominent note="Après le socle connu, vos inputs et la réserve. Hors événements encore inconnus." />
        <Figure label="Revenus attendus" value={forecast.income.central} note="Probable, pas encore encaissé." /><Figure label="Socle central" value={scenario.economicCost.central} note="Consommation économique connue et déclarée." /></div>
      <p className="mt-4 text-sm text-white/80">Réserve de sécurité : <strong>{currency(stored.inputs.safetyReserve)}</strong> · Disponible maintenant : <strong>{scenario.availableNow.status === "UNAVAILABLE" ? "Inconnu" : currency(scenario.availableNow.value)}</strong></p>
    </section>

    <section className="card p-5 sm:p-7" aria-labelledby="forecast-scenarios"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="forecast-scenarios" className="text-xl font-black">Trois scénarios</h2><span className="text-xs font-semibold text-slate-500">FreeToSpend mensuel · socle connu</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Scenario label="Prudent" range={scenario.freeToSpend} field="low" /><Scenario label="Central" range={scenario.freeToSpend} field="central" active /><Scenario label="Favorable" range={scenario.freeToSpend} field="high" /></div>
      <p className="mt-4 text-sm text-slate-600">L’amplitude vient des revenus probables et des dépenses habituelles observées. Les événements non déclarés et les échéances conditionnelles restent inconnus.</p>
      <details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer font-semibold">Voir le socle économique bas / central / haut</summary><p className="mt-2">{currency(scenario.economicCost.low)} · {currency(scenario.economicCost.central)} · {currency(scenario.economicCost.high)}</p></details>
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
      <section className="card p-5 sm:p-7" aria-labelledby="forecast-funding"><h2 id="forecast-funding" className="text-xl font-black">Funding · Benefit</h2><p className="mt-1 text-sm text-slate-600">Le financement ne réduit pas la consommation économique.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Figure label="Benefit probable" value={forecast.funding.benefitHistoricalRange.central} note="Repère historique, non confirmé pour ce mois." /><Figure label="Solde Benefit déclaré" value={stored.inputs.benefit.currentBalance?.amount ?? null} note="Séparé du coût alimentaire." /></div><p className="mt-4 text-sm text-slate-700">Besoin cash avant Benefit : <strong>{currency(forecast.cash.grossBeforeUnconfirmedFunding.central)}</strong></p><p className="mt-1 text-sm text-slate-700">Chargement attendu déclaré : <strong>{currency(stored.inputs.benefit.expectedLoading?.amount ?? null)}</strong> · non reçu.</p><p className="mt-1 text-sm text-slate-700">Si le financement historique se confirme : <strong>{currency(forecast.cash.afterPotentialBenefit.central)}</strong> hors Benefit.</p></section></div>

    <div className="grid gap-6 lg:grid-cols-2"><section className="card p-5 sm:p-7" aria-labelledby="forecast-events"><h2 id="forecast-events" className="text-xl font-black">Événements</h2><p className="mt-3 text-sm text-slate-700">Prévu par vous : {stored.inputs.plannedEvents.length === 0 ? "aucun événement enregistré pour ce mois." : `${stored.inputs.plannedEvents.length} événement(s).`}</p><p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Delta déclaré : {currency(scenario.userPlannedEventDelta)} · Autres événements : Inconnu</p><p className="mt-2 text-xs text-slate-500">Un événement futur non déclaré ne vaut pas zéro.</p></section>
      <section className="card p-5 sm:p-7" aria-labelledby="forecast-confirm"><h2 id="forecast-confirm" className="text-xl font-black">À confirmer</h2><ul className="mt-3 space-y-2 text-sm text-slate-700"><li>Ornikar / Alma : {stored.inputs.confirmedObligations.length ? "échéance déclarée par vous, incluse dans le scénario." : "échéance du mois non prouvée."}</li><li>Benefit / Swile : {stored.inputs.benefit.currentBalance ? "solde déclaré ; chargement et utilisation future restent à vérifier." : "financement et solde actuel à vérifier."}</li><li>Données récentes : août et septembre ne figurent pas encore dans les références publiées.</li><li>Disponible immédiat : {scenario.availableNow.status === "AVAILABLE" ? "calculé depuis votre solde daté d’aujourd’hui, moins la réserve." : "solde actuel ou mouvements depuis ce solde à confirmer."}</li></ul></section></div>

    <section className="card p-5 sm:p-7" aria-labelledby="forecast-inputs">
      <h2 id="forecast-inputs" className="text-xl font-black">Vos informations pour ce mois</h2>
      {inputError && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">Information invalide : vérifiez les montants, dates et enveloppes remplacées.</p>}
      <p className="mt-1 text-sm text-slate-600">Elles complètent la prévision publiée. Dernière modification : {stored.updatedAt ? dateLabel(stored.updatedAt) : "aucune"}.</p>
      <form action={updateMonthInputs} className="mt-5 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="targetMonth" value={forecast.meta.targetMonth} /><input type="hidden" name="intent" value="settings" />
        <label className="text-sm font-semibold">Réserve de sécurité (€)<input className="mt-1 w-full rounded-lg border p-2" name="safetyReserve" type="number" min="0" step="0.01" required defaultValue={stored.inputs.safetyReserve} /></label>
        <label className="text-sm font-semibold">Solde bancaire d’ouverture (€)<input className="mt-1 w-full rounded-lg border p-2" name="openingAmount" type="number" step="0.01" defaultValue={stored.inputs.openingBalance?.amount ?? ""} /></label>
        <label className="text-sm font-semibold">Date du solde bancaire<input className="mt-1 w-full rounded-lg border p-2" name="openingDate" type="date" defaultValue={stored.inputs.openingBalance?.asOfDate ?? ""} /></label>
        <label className="text-sm font-semibold">Solde Benefit actuel (€)<input className="mt-1 w-full rounded-lg border p-2" name="benefitBalance" type="number" min="0" step="0.01" defaultValue={stored.inputs.benefit.currentBalance?.amount ?? ""} /></label>
        <label className="text-sm font-semibold">Date du solde Benefit<input className="mt-1 w-full rounded-lg border p-2" name="benefitDate" type="date" defaultValue={stored.inputs.benefit.currentBalance?.asOfDate ?? ""} /></label>
        <label className="text-sm font-semibold">Chargement Benefit attendu (€)<input className="mt-1 w-full rounded-lg border p-2" name="benefitLoading" type="number" min="0" step="0.01" defaultValue={stored.inputs.benefit.expectedLoading?.amount ?? ""} /></label>
        <label className="text-sm font-semibold">Date prévue du chargement<input className="mt-1 w-full rounded-lg border p-2" name="loadingDate" type="date" defaultValue={stored.inputs.benefit.expectedLoading?.expectedDate ?? ""} /></label>
        <div className="sm:col-span-2"><button className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white" type="submit">Enregistrer les informations</button></div>
      </form>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div><h3 className="font-bold">Événement prévu par vous</h3>
          <form action={updateMonthInputs} className="mt-2 grid gap-2">
            <input type="hidden" name="targetMonth" value={forecast.meta.targetMonth} /><input type="hidden" name="intent" value="add-event" />
            <input className="rounded-lg border p-2" name="eventLabel" placeholder="Événement" aria-label="Événement" required />
            <input className="rounded-lg border p-2" name="eventDate" type="date" defaultValue={`${forecast.meta.targetMonth}-01`} required aria-label="Date de l’événement" />
            <label className="text-sm">Coût prévu (€)<input className="mt-1 w-full rounded-lg border p-2" name="eventCost" type="number" min="0" step="0.01" required /></label>
            <label className="text-sm">Dépense habituelle remplacée (€)<input className="mt-1 w-full rounded-lg border p-2" name="baselineDisplaced" type="number" min="0" step="0.01" defaultValue="0" required /></label>
            <label className="text-sm">Enveloppe habituelle remplacée<select className="mt-1 w-full rounded-lg border p-2" name="eventParent"><option value="">Aucune</option>{forecast.components.filter((part) => REPLACEABLE_ENVELOPES.some((key) => key === part.key)).map((part) => <option key={part.key} value={part.key}>{part.label}</option>)}</select></label>
            <button className="rounded-lg border border-slate-900 px-4 py-2 font-bold" type="submit">Ajouter l’événement</button>
          </form>
          <ul className="mt-3 space-y-2">{stored.inputs.plannedEvents.map((event) => <li key={event.id} className="flex items-center justify-between gap-2 text-sm"><span>{event.label} · {currency(event.plannedCost)} · remplace {currency(event.baselineDisplaced)}</span><form action={updateMonthInputs}><input type="hidden" name="targetMonth" value={forecast.meta.targetMonth} /><input type="hidden" name="intent" value="remove-event" /><input type="hidden" name="eventId" value={event.id} /><button className="underline" type="submit">Retirer</button></form></li>)}</ul>
        </div>
        <div><h3 className="font-bold">Échéance conditionnelle confirmée</h3>
          <form action={updateMonthInputs} className="mt-2 grid gap-2">
            <input type="hidden" name="targetMonth" value={forecast.meta.targetMonth} /><input type="hidden" name="intent" value="confirm-obligation" />
            <select className="rounded-lg border p-2" name="componentKey" required aria-label="Échéance conditionnelle">{obligations.filter((part) => part.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/iu.test(part.label)).map((part) => <option key={part.key} value={part.key}>{part.label}</option>)}</select>
            <input className="rounded-lg border p-2" name="obligationDate" type="date" defaultValue={`${forecast.meta.targetMonth}-01`} required aria-label="Date de l’échéance" />
            <input className="rounded-lg border p-2" name="obligationAmount" type="number" min="0" step="0.01" required aria-label="Montant confirmé" placeholder="Montant confirmé (€)" />
            <button className="rounded-lg border border-slate-900 px-4 py-2 font-bold" type="submit">Confirmer l’échéance</button>
          </form>
          <ul className="mt-3 space-y-2">{stored.inputs.confirmedObligations.map((item) => <li key={item.componentKey} className="flex items-center justify-between gap-2 text-sm"><span>{obligations.find((part) => part.key === item.componentKey)?.label} · {currency(item.amount)}</span><form action={updateMonthInputs}><input type="hidden" name="targetMonth" value={forecast.meta.targetMonth} /><input type="hidden" name="intent" value="remove-obligation" /><input type="hidden" name="componentKey" value={item.componentKey} /><button className="underline" type="submit">Retirer</button></form></li>)}</ul>
        </div>
      </div>
    </section>
    <section className="rounded-3xl border border-emerald-300 bg-emerald-50/60 p-5 sm:p-7" aria-labelledby="forecast-what-if"><h2 id="forecast-what-if" className="text-xl font-black">Et si vous faisiez un achat ?</h2><p className="mt-2 text-sm text-slate-600">Simulation temporaire, sans modifier la prévision publiée ni vos informations enregistrées.</p>
      {whatIfError && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert">Simulation invalide : vérifiez le montant couvert et l’enveloppe choisie.</p>}
      <form method="get" className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">Achat envisagé (€)<input className="mt-1 w-full rounded-lg border p-2" name="purchase" type="number" min="0" step="0.01" required defaultValue={scenario.whatIf?.amount ?? ""} /></label>
        <label className="text-sm font-semibold">Déjà couvert par une enveloppe (€)<input className="mt-1 w-full rounded-lg border p-2" name="covered" type="number" min="0" step="0.01" defaultValue={scenario.whatIf?.covered ?? "0"} /></label>
        <label className="text-sm font-semibold">Enveloppe parent<select className="mt-1 w-full rounded-lg border p-2" name="parent" defaultValue={scenario.whatIf?.parentEnvelope ?? ""}><option value="">Aucune</option>{forecast.components.filter((part) => REPLACEABLE_ENVELOPES.some((key) => key === part.key)).map((part) => <option value={part.key} key={part.key}>{part.label}</option>)}</select></label>
        <button className="rounded-lg bg-emerald-800 px-4 py-2 font-bold text-white sm:col-span-3" type="submit">Simuler</button>
      </form>
      {scenario.whatIf && <div className="mt-4 grid gap-3 sm:grid-cols-3"><Figure label="Impact additif" value={scenario.whatIf.additiveImpact} /><Figure label="FreeToSpend après achat" value={scenario.freeToSpend.central} /><Figure label="Cash prudent après achat" value={scenario.cashPrudent.central} /></div>}
      <p className="mt-3 text-xs text-slate-600">Cash prudent avant Benefit confirmé : {currency(scenario.cashPrudent.central)}. Solde Benefit et chargement attendu : {currency(scenario.benefitPotential)}. AvailableNow : {scenario.availableNow.status === "AVAILABLE" ? currency(scenario.availableNow.value) : "Inconnu — mouvements depuis le solde d’ouverture non établis ou solde absent"}.</p>
    </section>
  </div>;
}
