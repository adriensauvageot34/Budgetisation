import type { ForecastComponent } from "@/server/phase2/month-forecast";
import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { StoredMonthInputs } from "@/server/phase2/month-inputs";
import { REPLACEABLE_ENVELOPES, type MonthScenario } from "@/server/phase2/month-scenario";
import { updateMonthInputs } from "@/app/mois-a-venir/actions";

const money = (value: string | null, exact = false) => value === null ? "À confirmer" : new Intl.NumberFormat("fr-FR", {
  style: "currency", currency: "EUR", maximumFractionDigits: exact ? 2 : 0, minimumFractionDigits: exact ? 2 : 0,
}).format(Number(value));
const monthLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T12:00:00Z`));
const dateLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const lifeKeys = ["food", "health", "personal-care", "tobacco-vape", "work-coffee", "animal-care"] as const;
const eventKinds = ["Soirée", "Restaurant", "Famille", "Voyage / déplacement", "Achat", "Autre"] as const;
const labelFor = (part: ForecastComponent) => part.key === "food" ? "Alimentation & sorties" : part.key === "mobility-usage" ? "Voiture & essence" : part.label;
const confidence = (part: ForecastComponent) => part.confidence === "LOW" ? "Estimation à affiner" : part.nature === "CONTRACTUAL_EXPECTED" ? "Engagé ou très probable" : "Estimation habituelle";

function Details({ part }: { part: ForecastComponent }) {
  return <details className="text-xs text-slate-600"><summary className="cursor-pointer rounded-md font-semibold text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-700">Détails</summary>
    <div className="mt-2 space-y-1"><p>Prévision : {money(part.central, true)}. Intervalle : {money(part.low, true)} à {money(part.high, true)}.</p>
      <p>{confidence(part)}. Références disponibles jusqu’au {part.freshnessDate ? dateLabel(part.freshnessDate) : "date non précisée"}.</p>
      <details className="pt-1 text-xs"><summary className="cursor-pointer font-semibold">Voir les détails techniques</summary><p className="mt-1 break-all">Référence : {part.referenceMode} · Sources : {part.provenance.join(" · ") || "non précisées"} · Limites : {part.limitations.join(" · ") || "aucune"}</p></details>
    </div>
  </details>;
}

function DecisionForm({ targetMonth, intent, componentKey, label }: { targetMonth: string; intent: string; componentKey: string; label: string }) {
  return <form action={updateMonthInputs}><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value={intent} /><input type="hidden" name="componentKey" value={componentKey} /><button type="submit" className="min-h-9 rounded-lg px-2 text-xs font-bold text-emerald-900 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-700">{label}</button></form>;
}

function UndatedRow({ part, kind, targetMonth, excluded = false, declined = false }: { part: ForecastComponent; kind: "Revenu attendu" | "Charge fixe" | "Dépense possible"; targetMonth: string; excluded?: boolean; declined?: boolean }) {
  const isIncome = kind === "Revenu attendu";
  const isFixed = kind === "Charge fixe";
  const status = excluded ? `Retiré de ${monthLabel(targetMonth)}` : declined ? `Non prévu en ${monthLabel(targetMonth)}` : part.central === null ? "À confirmer" : "Date à confirmer";
  return <li className="border-b border-slate-200 py-2.5 last:border-0"><div className="flex items-start gap-3"><span className="w-14 shrink-0 pt-1 text-center text-[11px] font-extrabold uppercase leading-tight text-slate-500">Date<br />à confirmer</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-bold">{part.label}</p><p className="text-xs text-slate-600">{isIncome ? "＋ Revenu attendu" : isFixed ? "− Charge fixe" : "? Dépense possible"} · {status}</p></div><strong className="shrink-0 whitespace-nowrap text-sm">{excluded || declined ? "Hors prévision" : part.central === null ? "À confirmer" : `${isIncome ? "+" : "−"} ${money(part.central)}`}</strong></div>
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"><Details part={part} />{isFixed && (excluded
      ? <DecisionForm targetMonth={targetMonth} intent="restore-fixed" componentKey={part.key} label="Réintégrer ce mois" />
      : <details className="text-xs"><summary className="cursor-pointer font-bold text-emerald-800">Retirer ce mois</summary><p className="mt-2 max-w-md text-slate-600">Ne plus compter {part.label} ({money(part.central)}) en {monthLabel(targetMonth)} ? Votre historique et les autres mois ne changent pas.</p><DecisionForm targetMonth={targetMonth} intent="exclude-fixed" componentKey={part.key} label={`Confirmer le retrait de ${monthLabel(targetMonth)}`} /></details>)}
      {!isIncome && !isFixed && part.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/iu.test(part.label) && <div className="flex flex-wrap items-center gap-1"><details className="text-xs"><summary className="cursor-pointer font-bold text-emerald-800">Oui, prévu</summary><ActionForm targetMonth={targetMonth} intent="confirm-obligation" label="Inclure cette dépense"><input type="hidden" name="componentKey" value={part.key} /><Field label="Date prévue" name="obligationDate" type="date" min={`${targetMonth}-01`} max={new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)), 0)).toISOString().slice(0, 10)} required /><Field label="Montant confirmé (€)" name="obligationAmount" type="number" min="0" required /></ActionForm></details><DecisionForm targetMonth={targetMonth} intent="decline-conditional" componentKey={part.key} label="Non" /><DecisionForm targetMonth={targetMonth} intent="unknown-conditional" componentKey={part.key} label="Je ne sais pas" /></div>}</div></div></div></li>;
}

function ActionForm({ targetMonth, intent, children, label }: { targetMonth: string; intent: string; children: React.ReactNode; label: string }) {
  return <form action={updateMonthInputs} className="mt-3 grid gap-3"><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value={intent} />{children}
    <button className="min-h-11 rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800" type="submit">{label}</button></form>;
}

function Field({ label, name, type = "text", value, min, max, required = false }: { label: string; name: string; type?: string; value?: string; min?: string; max?: string; required?: boolean }) {
  return <label className="grid gap-1 text-sm font-semibold text-slate-800">{label}<input className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-emerald-700" name={name} type={type} min={min} max={max} step={type === "number" ? "0.01" : undefined} defaultValue={value} required={required} /></label>;
}

type Props = { forecast: MonthForecastSnapshot; scenario: MonthScenario; baseScenario: MonthScenario; stored: StoredMonthInputs;
  eventImpacts: Record<string, string | null>; today: string; purchaseName: string; whatIfError: boolean; inputError: boolean };

export function MonthForecastView({ forecast, scenario, baseScenario, stored, eventImpacts, today, purchaseName, whatIfError, inputError }: Props) {
  const targetMonth = forecast.meta.targetMonth;
  const obligations = forecast.components.filter((part) => part.key.startsWith("obligation:"));
  const conditional = obligations.filter((part) => part.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/iu.test(part.label));
  const pending = conditional.filter((part) => !stored.inputs.confirmedObligations.some((item) => item.componentKey === part.key)
    && !stored.inputs.declinedConditionalObligations.includes(part.key));
  const fixed = obligations.filter((part) => part.nature === "CONTRACTUAL_EXPECTED" && part.additiveGroup === "obligations" && part.central !== null);
  const includedFixed = fixed.filter((part) => !stored.inputs.excludedFixedObligations.includes(part.key));
  const excludedFixed = fixed.filter((part) => stored.inputs.excludedFixedObligations.includes(part.key));
  const otherObligations = obligations.filter((part) => !fixed.some((item) => item.key === part.key)
    && !conditional.some((item) => item.key === part.key));
  const usual = lifeKeys.map((key) => forecast.components.find((part) => part.key === key)).filter((part): part is ForecastComponent => part !== undefined);
  const largest = Math.max(1, ...usual.map((part) => part.central === null ? 0 : Number(part.central)));
  const hasBank = stored.inputs.openingBalance !== null;
  const hasSwile = stored.inputs.benefit.currentBalance !== null;
  const actions = (baseScenario.availableNow.status === "UNAVAILABLE" ? 1 : 0) + (hasSwile ? 0 : 1) + pending.length;
  const dated = [
    ...stored.inputs.plannedEvents.map((item) => ({ id: item.id, date: item.plannedDate, label: item.label, amount: item.plannedCost, kind: "Prévu par vous", impact: eventImpacts[item.id] ?? null })),
    ...stored.inputs.confirmedObligations.map((item) => ({ id: item.componentKey, date: item.dueDate, label: obligations.find((part) => part.key === item.componentKey)?.label ?? "Échéance confirmée", amount: item.amount, kind: "Confirmé par vous", impact: null })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const undated = [
    ...forecast.income.components.map((part) => ({ part, kind: "Revenu attendu" as const })),
    ...includedFixed.map((part) => ({ part, kind: "Charge fixe" as const })),
    ...pending.map((part) => ({ part, kind: "Dépense possible" as const })),
    ...conditional.filter((part) => stored.inputs.declinedConditionalObligations.includes(part.key)).map((part) => ({ part, kind: "Dépense possible" as const })),
    ...otherObligations.map((part) => ({ part, kind: "Dépense possible" as const })),
  ];
  const monthIsCurrent = today.slice(0, 7) === targetMonth;
  const monthEnd = new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const summary = baseScenario.freeToSpend.central;

  return <main className="mx-auto max-w-5xl space-y-7 pb-20 text-slate-900">
    <header className="space-y-2"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-800">Préparer notre mois ensemble</p>
      <h1 className="text-4xl font-black capitalize tracking-tight sm:text-5xl">{monthLabel(targetMonth)}</h1>
      <p className="text-slate-600">Prévision basée sur vos habitudes et ce que vous avez déjà prévu.</p></header>

    <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 p-6 text-white shadow-lg sm:p-9" aria-labelledby="month-summary">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-100">Notre {monthLabel(targetMonth)}</p>
        <h2 id="month-summary" className="mt-2 text-5xl font-black tracking-tight sm:text-7xl">{money(summary)}</h2><p className="mt-1 text-xl font-bold">encore à répartir</p>
        <p className="mt-3 text-sm text-emerald-100">Après vos dépenses prévues et votre réserve de sécurité.</p></div>
        <a href="#affiner" className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25">{actions ? `Prévision à compléter · ${actions} ${actions > 1 ? "choses à vérifier" : "chose à vérifier"}` : "Prévision à jour"}</a></div>
      <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-white/20 pt-6 sm:grid-cols-4" aria-label="Calcul du reste à répartir">
        <div><p className="text-xs text-emerald-100">Revenus attendus</p><p className="mt-1 text-xl font-bold">{money(forecast.income.central)}</p></div>
        <div><p className="text-xs text-emerald-100">− Dépenses prévues</p><p className="mt-1 text-xl font-bold">{money(baseScenario.economicCost.central)}</p></div>
        <div><p className="text-xs text-emerald-100">− Gardés en sécurité</p><p className="mt-1 text-xl font-bold">{money(stored.inputs.safetyReserve)}</p></div>
        <div><p className="text-xs text-emerald-100">= Encore à répartir</p><p className="mt-1 text-xl font-bold">{money(summary)}</p></div>
      </div>
      <div className="mt-6 border-t border-white/20 pt-4 text-sm text-emerald-50">{baseScenario.availableNow.status === "AVAILABLE" ? <p>Disponible aujourd’hui, après réserve : <strong>{money(baseScenario.availableNow.value)}</strong></p> : <p>Ce montant n’est pas votre solde disponible aujourd’hui. <a href="#bank-balance" className="font-bold underline underline-offset-2">{hasBank ? "Mettre à jour mon solde" : "Renseigner mon solde"}</a></p>}</div>
    </section>

    <section aria-labelledby="scenarios-title"><div className="flex items-baseline justify-between gap-3"><h2 id="scenarios-title" className="text-xl font-black">Et si le mois varie ?</h2><span className="text-xs text-slate-500">Réserve déjà déduite</span></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">{([
        ["Si le mois coûte un peu plus", baseScenario.freeToSpend.low], ["Prévision actuelle", baseScenario.freeToSpend.central], ["Si le mois coûte un peu moins", baseScenario.freeToSpend.high],
      ] as const).map(([label, amount], index) => <div key={label} className={`rounded-2xl border p-4 ${index === 1 ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white"}`}><p className="text-sm font-semibold text-slate-600">{label}</p><p className="mt-1 text-2xl font-black">{money(amount)}</p></div>)}</div>
      <details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-emerald-800">Comment lire ces prévisions ?</summary><p className="mt-2">Elles encadrent les revenus et dépenses habituels observés. Les événements non déclarés et les échéances encore incertaines ne sont pas comptés comme zéro.</p></details>
    </section>

    <section className="card p-4 sm:p-7" aria-labelledby="timeline-title"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="timeline-title" className="text-2xl font-black">Calendrier financier</h2><span className="text-sm text-slate-600">{monthLabel(targetMonth)}</span></div>
      <p className="mt-1 text-sm text-slate-600">Entrées, charges reconnues et projets du mois. Une date inconnue ne retire pas une charge fixe du calcul.</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2"><div><h3 className="text-sm font-black">Charges fixes prévues</h3><p className="text-xs text-slate-600">{includedFixed.length} prélèvements reconnus, inclus automatiquement</p></div><strong className="text-lg">{money(baseScenario.fixedExpenseTotal)}</strong></div>
      {dated.length > 0 && <><h3 className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">Dates connues</h3><ol className="mt-2 divide-y divide-slate-200 border-l-2 border-emerald-300 pl-3">{dated.map((item) => <li key={item.id} className="flex items-start gap-3 py-2.5"><span className="w-14 shrink-0 pt-1 text-center text-[11px] font-extrabold uppercase text-emerald-800">{dateLabel(item.date)}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-sm font-bold">{item.label}</p><p className="text-xs text-slate-600">− {item.kind}{monthIsCurrent ? item.date < today ? " · Date passée, réalisation non confirmée" : item.date === today ? " · Aujourd’hui" : " · Reste du mois" : ""}</p></div><strong className="shrink-0 whitespace-nowrap text-sm">− {money(item.amount)}</strong></div>{item.impact !== null && <p className="text-xs text-slate-600">Impact supplémentaire : {money(item.impact)}</p>}{item.kind === "Confirmé par vous" && <div className="mt-1 flex flex-wrap gap-2"><DecisionForm targetMonth={targetMonth} intent="decline-conditional" componentKey={item.id} label="Non" /><DecisionForm targetMonth={targetMonth} intent="unknown-conditional" componentKey={item.id} label="Je ne sais pas" /></div>}</div></li>)}</ol></>}
      <h3 className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">Date à confirmer</h3>
      {undated.length ? <ul className="mt-2 divide-y divide-slate-200 border-l-2 border-slate-200 pl-3">{undated.map((item) => <UndatedRow key={item.part.key} part={item.part} kind={item.kind} targetMonth={targetMonth} declined={stored.inputs.declinedConditionalObligations.includes(item.part.key)} />)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucun autre élément sans date.</p>}
      {excludedFixed.length > 0 && <details className="mt-4 rounded-xl border border-slate-200 px-3 py-2"><summary className="cursor-pointer text-sm font-bold text-emerald-800">Voir les {excludedFixed.length} charges retirées ce mois</summary><ul className="mt-2 divide-y divide-slate-200">{excludedFixed.map((part) => <UndatedRow key={part.key} part={part} kind="Charge fixe" targetMonth={targetMonth} excluded />)}</ul></details>}
      {forecast.income.components.length === 0 && <p className="mt-3 text-sm text-amber-900">Les revenus attendus ne sont pas assez établis pour être détaillés.</p>}
    </section>

    <section className="card p-5 sm:p-7" aria-labelledby="usual-title"><h2 id="usual-title" className="text-2xl font-black">Dépenses variables prévues</h2><p className="mt-1 text-sm text-slate-600">Ce que vos habitudes laissent prévoir pour {monthLabel(targetMonth)}. Ces postes n’ont pas de date précise.</p>
      <ul className="mt-5 divide-y divide-slate-100">{usual.map((part) => <li key={part.key} className="py-3"><div className="flex items-baseline justify-between gap-3"><span className="font-semibold">{labelFor(part)}</span><strong className="whitespace-nowrap">{money(part.central)}</strong></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${part.central === null ? 0 : Math.max(0, Math.min(100, Number(part.central) / largest * 100))}%` }} /></div>
        <Details part={part} /></li>)}</ul>
      <details className="mt-4 text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-emerald-800">Voir les sous-postes connus</summary><ul className="mt-2 space-y-1">{forecast.components.filter((part) => part.parentEnvelope !== null).map((part) => <li key={part.key}>{part.label} · {money(part.central)}</li>)}</ul></details>
    </section>

    <div className="grid gap-4 lg:grid-cols-2"><section className="card p-5 sm:p-6"><h2 className="text-xl font-black">Voiture & essence</h2><p className="mt-2 text-3xl font-black">{money(forecast.components.find((part) => part.key === "mobility-usage")?.central ?? null)}</p><p className="text-sm text-slate-600">Prévus ce mois selon votre usage habituel connu.</p><details className="mt-3 text-sm text-slate-600"><summary className="cursor-pointer font-semibold text-emerald-800">Pourquoi ce montant ?</summary><p className="mt-2">Cette estimation décrit l’usage de la voiture. Les pleins payés sont suivis séparément dans la prévision de trésorerie.</p></details></section>
      <section className="card p-5 sm:p-6"><h2 className="text-xl font-black">Swile / titres-restaurant</h2><p className="mt-2 text-lg font-bold">{forecast.funding.benefitHistoricalRange.central === null ? "Estimation historique indisponible" : `${money(forecast.funding.benefitHistoricalRange.central)} habituellement financés via Swile`}</p><p className="mt-2 text-sm text-slate-600">Solde actuel : {hasSwile ? money(stored.inputs.benefit.currentBalance!.amount) : "à renseigner"}</p><p className="text-sm text-slate-600">Chargement attendu : {money(stored.inputs.benefit.expectedLoading?.amount ?? null)}</p><a href="#swile-balance" className="mt-3 inline-block text-sm font-bold text-emerald-800 underline">{hasSwile ? "Mettre à jour Swile" : "Renseigner mon solde"}</a></section></div>

    <section id="affiner" className="card scroll-mt-6 p-5 sm:p-7" aria-labelledby="actions-title"><h2 id="actions-title" className="text-2xl font-black">Pour affiner {monthLabel(targetMonth)}</h2>
      <ul className="mt-4 space-y-2 text-sm">{baseScenario.availableNow.status === "UNAVAILABLE" && <li className="rounded-xl bg-amber-50 p-3"><strong>Action nécessaire · Disponible aujourd’hui</strong><p className="text-slate-700">{hasBank ? "Votre solde doit être daté d’aujourd’hui pour ce calcul." : "Votre solde bancaire n’est pas renseigné."} <a href="#bank-balance" className="font-bold underline">Mettre à jour</a></p></li>}
        {!hasSwile && <li className="rounded-xl bg-amber-50 p-3"><strong>À compléter · Solde Swile</strong><p><a href="#swile-balance" className="font-bold underline">Renseigner le solde</a> pour préciser le financement possible.</p></li>}
        {pending.map((part) => <li key={part.key} className="rounded-xl bg-amber-50 p-3"><strong>À confirmer · {part.label} en {monthLabel(targetMonth)} ?</strong><p>Cette échéance n’est pas encore incluse. <a href="#timeline-title" className="font-bold underline">Répondre dans le calendrier</a></p></li>)}
        <li className="rounded-xl bg-emerald-50 p-3"><strong>Prévu quelque chose ?</strong> <a href="#add-event" className="font-bold text-emerald-900 underline">L’ajouter au mois</a></li></ul>
      <details className="mt-4 text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Fraîcheur des données et détails de la prévision</summary><p className="mt-2">Prévision calculée le {dateLabel(forecast.meta.computedAt.slice(0, 10))}. Les références de chaque poste sont précisées dans « Pourquoi ce montant ? ». Certaines habitudes récentes peuvent manquer.</p><p className="mt-1 break-all">Publication {forecast.meta.sourcePublicationId} · Révision {forecast.meta.analyticsRevision}</p></details>
    </section>

    <section className="card p-5 sm:p-7" aria-labelledby="complete-title"><h2 id="complete-title" className="text-2xl font-black">Compléter {monthLabel(targetMonth)}</h2><p className="mt-1 text-sm text-slate-600">Choisissez seulement ce que vous voulez préciser. Les réponses sont enregistrées pour ce mois.</p>
      {inputError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">Impossible d’enregistrer : vérifiez les montants, les dates et la part déjà prévue.</p>}
      <div className="mt-4 grid gap-3 lg:grid-cols-2"><details id="bank-balance" className="scroll-mt-6 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer font-bold">Mettre à jour notre solde bancaire · {hasBank ? "renseigné" : "à renseigner"}</summary><ActionForm targetMonth={targetMonth} intent="save-bank-balance" label="Enregistrer le solde"><Field label="Solde bancaire (€)" name="openingAmount" type="number" value={stored.inputs.openingBalance?.amount} /><Field label="Date du solde" name="openingDate" type="date" value={stored.inputs.openingBalance?.asOfDate} /><p className="text-xs text-slate-600">Le disponible aujourd’hui n’est calculable qu’avec un solde daté d’aujourd’hui.</p></ActionForm></details>
        <details id="swile-balance" className="scroll-mt-6 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer font-bold">Mettre à jour Swile · {hasSwile ? "renseigné" : "à renseigner"}</summary><ActionForm targetMonth={targetMonth} intent="save-benefit" label="Enregistrer Swile"><Field label="Solde Swile actuel (€)" name="benefitBalance" type="number" min="0" value={stored.inputs.benefit.currentBalance?.amount} /><Field label="Date du solde" name="benefitDate" type="date" value={stored.inputs.benefit.currentBalance?.asOfDate} /><Field label="Chargement attendu (€), si connu" name="benefitLoading" type="number" min="0" value={stored.inputs.benefit.expectedLoading?.amount} /><Field label="Date prévue du chargement" name="loadingDate" type="date" value={stored.inputs.benefit.expectedLoading?.expectedDate} /></ActionForm></details>
        <details id="reserve" className="scroll-mt-6 rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer font-bold">Modifier notre marge de sécurité · {money(stored.inputs.safetyReserve)}</summary><ActionForm targetMonth={targetMonth} intent="save-reserve" label="Enregistrer la réserve"><Field label="Montant à garder en sécurité (€)" name="safetyReserve" type="number" min="0" value={stored.inputs.safetyReserve} required /></ActionForm></details>
      </div>
      <div id="add-event" className="mt-5 scroll-mt-6 rounded-2xl bg-emerald-50 p-4 sm:p-5"><h3 className="text-lg font-black">Ajouter quelque chose de prévu</h3><p className="text-sm text-slate-600">Une sortie, un voyage ou un achat : ajoutez ce que vous avez réellement décidé.</p>
        <ActionForm targetMonth={targetMonth} intent="add-event" label="Ajouter à notre mois"><label className="grid gap-1 text-sm font-semibold">De quoi s’agit-il ?<select name="eventKind" className="min-h-11 rounded-xl border border-slate-300 bg-white px-3">{eventKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label><Field label="Nom ou précision (facultatif)" name="eventLabel" /><div className="grid gap-3 sm:grid-cols-2"><Field label="Date prévue" name="eventDate" type="date" min={`${targetMonth}-01`} max={monthEnd} required /><Field label="Coût prévu (€)" name="eventCost" type="number" min="0" required /></div>
          <details className="rounded-xl border border-emerald-200 bg-white p-3 text-sm"><summary className="cursor-pointer font-semibold">Cela remplace-t-il une dépense déjà prévue dans votre mois habituel ?</summary><p className="mt-2 text-slate-600">Si vous connaissez la part déjà prévue, indiquez-la. Sinon, laissez vide : le coût entier sera ajouté.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Part déjà prévue (€)" name="baselineDisplaced" type="number" min="0" value="0" /><label className="grid gap-1 font-semibold">Dans quel poste ?<select name="eventParent" className="min-h-11 rounded-xl border border-slate-300 bg-white px-3"><option value="">Aucun / je ne sais pas</option>{forecast.components.filter((part) => REPLACEABLE_ENVELOPES.some((key) => key === part.key)).map((part) => <option key={part.key} value={part.key}>{labelFor(part)}</option>)}</select></label></div></details>
        </ActionForm>
        {stored.inputs.plannedEvents.length > 0 && <div className="mt-4"><h4 className="font-bold">Prévu par vous</h4><ul className="mt-2 space-y-2">{stored.inputs.plannedEvents.map((event) => <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm"><span><strong>{event.label}</strong> · {dateLabel(event.plannedDate)} · {money(event.plannedCost)}{eventImpacts[event.id] !== null && eventImpacts[event.id] !== undefined ? ` · impact supplémentaire ${money(eventImpacts[event.id])}` : ""}</span><form action={updateMonthInputs}><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="intent" value="remove-event" /><input type="hidden" name="eventId" value={event.id} /><button type="submit" className="font-bold text-emerald-800 underline">Retirer</button></form></li>)}</ul></div>}
      </div>
    </section>

    <section className="rounded-[2rem] border border-emerald-300 bg-emerald-50 p-5 sm:p-7" aria-labelledby="whatif-title"><h2 id="whatif-title" className="text-2xl font-black">Vous pensez acheter quelque chose ?</h2><p className="mt-1 text-sm text-slate-600">Testez l’impact avant de décider. La simulation ne change pas votre mois enregistré.</p>
      {whatIfError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">Simulation impossible : vérifiez le prix et la part déjà prévue.</p>}
      <form method="get" className="mt-4 grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><Field label="Quoi ?" name="purchaseName" value={purchaseName} required /><Field label="Prix (€)" name="purchase" type="number" min="0" value={scenario.whatIf?.amount} required /></div>
        <details className="rounded-xl border border-emerald-200 bg-white p-3 text-sm"><summary className="cursor-pointer font-semibold">Une partie est-elle déjà prévue dans votre mois habituel ?</summary><p className="mt-2 text-slate-600">Laissez zéro si vous ne savez pas. Le prix entier sera alors testé.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Part déjà prévue (€)" name="covered" type="number" min="0" value={scenario.whatIf?.covered ?? "0"} /><label className="grid gap-1 font-semibold">Poste concerné<select name="parent" className="min-h-11 rounded-xl border border-slate-300 bg-white px-3" defaultValue={scenario.whatIf?.parentEnvelope ?? ""}><option value="">Aucun / je ne sais pas</option>{forecast.components.filter((part) => REPLACEABLE_ENVELOPES.some((key) => key === part.key)).map((part) => <option key={part.key} value={part.key}>{labelFor(part)}</option>)}</select></label></div></details>
        <button className="min-h-11 rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white" type="submit">Voir l’impact</button></form>
      {scenario.whatIf && <div className="mt-5 rounded-2xl bg-white p-5" role="status"><h3 className="text-lg font-black">Si vous achetez {purchaseName || "cela"}</h3><p className="mt-2 text-2xl font-black">{money(summary)} → {money(scenario.freeToSpend.central)}</p><p className="mt-1 font-bold text-emerald-900">Impact supplémentaire : − {money(scenario.whatIf.additiveImpact)}</p><p className="mt-2 text-sm text-slate-600">Scénario où le mois coûte plus : {money(scenario.freeToSpend.low)}. Votre réserve de {money(stored.inputs.safetyReserve)} est déjà déduite.</p>{Number(scenario.whatIf.covered) > 0 && <p className="text-sm text-slate-600">Part déjà prévue : {money(scenario.whatIf.covered)}.</p>}
        <ActionForm targetMonth={targetMonth} intent="add-event" label="Ajouter réellement à notre mois"><input type="hidden" name="eventKind" value="Achat" /><input type="hidden" name="eventLabel" value={purchaseName || "Achat"} /><input type="hidden" name="eventCost" value={scenario.whatIf.amount} /><input type="hidden" name="baselineDisplaced" value={scenario.whatIf.covered} /><input type="hidden" name="eventParent" value={scenario.whatIf.parentEnvelope ?? ""} /><Field label="Date prévue pour cet achat" name="eventDate" type="date" min={`${targetMonth}-01`} max={monthEnd} required /></ActionForm>
        <a href="/mois-a-venir" className="mt-3 inline-block text-sm font-bold text-emerald-800 underline">Fermer la simulation</a></div>}
    </section>
  </main>;
}
