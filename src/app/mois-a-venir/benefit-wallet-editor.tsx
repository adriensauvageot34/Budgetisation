import type { MonthlyBenefitWalletInput } from "@/domain/phase2/benefit-wallets";
import type { BenefitWalletProjection } from "@/server/phase2/benefit-wallet-funding";
import type { MonthEconomicPlan } from "@/server/phase2/month-scenario";
import { updateMonthInputs } from "./actions";
import { controlMonth } from "@/domain/phase2/month-control-display";
import material from "./month-material.module.css";

const money = (value: string | null) => value === null ? "À confirmer" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
const dateLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
export function BenefitWalletEditor({ wallet, projection, targetMonth, today, funding }: { wallet: MonthlyBenefitWalletInput;
  projection?: BenefitWalletProjection; targetMonth: string; today: string; funding?: MonthEconomicPlan["plannedFunding"]["swile"] }) {
  const label = wallet.provider === "SWILE" ? "Swile" : "Edenred";
  const hidden = <><input type="hidden" name="targetMonth" value={targetMonth} /><input type="hidden" name="provider" value={wallet.provider} /></>;
  const fieldClass = `${material.field} field mt-1 w-full`;
  return <article data-wallet-card={wallet.provider} className={`${material.glassSecondary} p-4`}>
    <h3 className="text-lg font-bold">{label}<span className="ml-2 text-sm font-normal text-slate-600">{controlMonth(targetMonth)}</span></h3>
    <p className="mt-2 text-sm">Chargement prévu : <strong>{money(projection?.expectedLoading?.amount ?? wallet.expectedLoading?.amount ?? null)}</strong></p>
    <p className="mt-1 text-sm">Solde actuel : <strong>{projection?.currentBalanceKnowledge.amount == null ? "à renseigner" : money(projection.currentBalanceKnowledge.amount)}</strong></p>
    <p className="mt-1 text-sm text-slate-600">Capacité estimée : {money(projection?.usableCapacity ?? null)}</p>
    <details id={`${wallet.provider.toLowerCase()}-balance`} className={`${material.disclosure} mt-3 scroll-mt-24`}>
    <summary className="cursor-pointer text-sm font-bold text-violet-900">Mettre à jour {label}</summary>
    <p className="mt-3 text-sm text-slate-600">Un solde est le total présent sur la carte à cette date. Le chargement est un flux du mois, jamais la différence entre deux soldes.</p>
    {projection?.latestObservation && <p className="mt-3 text-sm">Dernière observation : <strong>{money(projection.latestObservation.amount)}</strong> au {dateLabel(projection.latestObservation.asOfDate)}.</p>}
    <p className="mt-1 text-sm text-slate-600">{projection?.currentBalanceKnowledge.amount != null
      ? `${projection.currentBalanceKnowledge.status === "RECONSTRUCTED" ? "Solde reconstruit" : "Solde connu"} au ${dateLabel(today)} : ${money(projection.currentBalanceKnowledge.amount)}.` : "Solde actuel à confirmer."}</p>
    {wallet.balanceObservations.length > 0 && <ul className="mt-3 space-y-2 text-sm" aria-label={`Observations ${label}`}>{wallet.balanceObservations.map(row => <li key={row.id} className="flex items-center justify-between gap-3">
      <span>{dateLabel(row.asOfDate)} · <strong>{money(row.amount)}</strong>{row.isOpeningObservation && !row.asOfDate.startsWith(targetMonth) ? " · solde de départ" : ""}</span>
      <form action={updateMonthInputs}>{hidden}<input type="hidden" name="intent" value="remove-wallet-balance-observation" /><input type="hidden" name="observationId" value={row.id} />
        <button className="text-sm font-semibold underline" aria-label={`Supprimer l’observation ${label} du ${dateLabel(row.asOfDate)}`}>Supprimer</button></form>
    </li>)}</ul>}
    <form action={updateMonthInputs} className="mt-4 grid grid-cols-2 gap-3">{hidden}<input type="hidden" name="intent" value="add-wallet-balance-observation" />
      <label className="text-sm font-semibold">Solde total {label} (€)<input className={fieldClass} name="walletBalanceAmount" type="number" min="0" max="999999999.99" step="0.01" required /></label>
      <label className="text-sm font-semibold">Date du solde<input className={fieldClass} name="walletBalanceDate" type="date" defaultValue={today} max={today} required /></label>
      <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="walletOpeningObservation" />Solde de départ provenant d’un mois antérieur</label>
      <p className="col-span-2 text-sm text-slate-600">À la même date, cette saisie corrige l’observation existante. Les autres dates sont conservées.</p>
      <button className={`${material.clayPrimary} col-span-2 px-4 py-2 text-sm font-bold`}>Ajouter une nouvelle observation</button>
    </form>
    <form action={updateMonthInputs} className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">{hidden}<input type="hidden" name="intent" value="save-wallet-expected-loading" />
      <label className="text-sm font-semibold">Chargement du mois (€)<input className={fieldClass} name="walletLoadingAmount" type="number" min="0" max="999999999.99" step="0.01" defaultValue={projection?.expectedLoading?.amount ?? wallet.expectedLoading?.amount} required /></label>
      <label className="text-sm font-semibold">Date prévue (facultative)<input className={fieldClass} name="walletLoadingDate" type="date" defaultValue={wallet.expectedLoading?.expectedDate ?? ""} min={`${targetMonth}-01`} max={new Date(Date.UTC(Number(targetMonth.slice(0, 4)), Number(targetMonth.slice(5)), 0)).toISOString().slice(0, 10)} /></label>
      <button className={`${material.clayPrimary} col-span-2 px-4 py-2 text-sm font-bold`}>Enregistrer le chargement {label}</button>
    </form>
    {wallet.expectedLoading && <form action={updateMonthInputs} className="mt-2">{hidden}<input type="hidden" name="intent" value="clear-wallet-expected-loading" />
      <button className="text-sm font-semibold underline">Retirer la prévision de chargement {label}</button></form>}
    </details>
    {projection && funding && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Voir le détail du financement</summary><BenefitWalletFundingDetails wallet={projection} funding={funding} /></details>}
  </article>;
}

function BenefitWalletFundingDetails({ wallet, funding }: { wallet: BenefitWalletProjection; funding: MonthEconomicPlan["plannedFunding"]["swile"] }) {
  return <div>
      {wallet.latestObservation && <p className="mt-1 text-sm text-slate-600">Dernier solde observé : {money(wallet.latestObservation.amount)} au {dateLabel(wallet.latestObservation.asOfDate)}.</p>}
      <dl className="mt-2 space-y-1 text-sm">{([
        [wallet.currentBalanceKnowledge.status === "RECONSTRUCTED" ? "Solde reconstruit" : "Solde actuel", wallet.currentBalanceKnowledge.amount],
        ["Chargement du mois (flux)", wallet.expectedLoading?.amount ?? null], ["Capacité utilisable sur la période", wallet.usableCapacity],
        ["Affecté explicitement aux projets", wallet.plannedReserved],
        ["Réservé aux projets prévus", funding.reserved],
        ["Usage déclaré", funding.usedDeclared],
        ["Part des projets supportable", wallet.plannedSupported],
        ["Financement estimé des repas", wallet.currentBalanceKnowledge.amount === null || wallet.ownerPersonId === null ? null : wallet.forecastExpectedUse.central], ["Capacité restante après projets et repas", wallet.remainingCapacityAfterForecast.central],
        ["À financer autrement (limite connue)", wallet.shortfall], ["Financement des projets à compléter ou confirmer", wallet.fundingToComplete],
      ] as const).map(([label, amount]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-semibold">{money(amount)}</dd></div>)}</dl>
      <p className="mt-2 text-sm text-slate-600">Règle du foyer : {money(wallet.policy.dailyCap)} par jour éligible · {wallet.eligibleDaysRemaining} jours sur la période.</p>
      {wallet.currentBalanceKnowledge.amount === null && <p className="mt-2 text-sm text-amber-900">Solde actuel à confirmer. Le financement inconnu n’est pas transformé en Banque certaine.</p>}
      {wallet.limitations.includes("BENEFIT_LOADING_DATE_UNKNOWN") && <p className="mt-2 text-sm text-slate-600">Date du chargement à préciser : ce flux n’est pas ajouté au stock.</p>}
      {wallet.limitations.includes("PLANNED_WALLET_DATE_UNRESOLVED") && <p className="mt-2 text-sm text-slate-600">Un projet sans date ou passé demande une confirmation de son financement.</p>}
      {wallet.limitations.includes("PLANNED_WALLET_DATE_INELIGIBLE") && <p className="mt-2 text-sm text-amber-900">Une allocation tombe un jour non éligible selon la règle du foyer.</p>}
      {wallet.ownerPersonId === null && <p className="mt-2 text-sm text-slate-600">Propriétaire non résolu : aucun repas personnel n’est automatiquement affecté à cette carte.</p>}
  </div>;
}

/** Compatibility display for existing callers; the Centre embeds these details in its wallet cards. */
export function BenefitWalletFunding({ wallets, funding }: { wallets: Readonly<Record<"SWILE" | "EDENRED", BenefitWalletProjection>>; funding: MonthEconomicPlan["plannedFunding"] }) {
  return <details id="meal-funding" className={`${material.glassSecondary} ${material.disclosure} p-4`}><summary className="cursor-pointer text-sm font-bold">Ce que vos cartes peuvent encore financer</summary>
    <div className="mt-3 grid grid-cols-2 gap-4">{Object.values(wallets).map(wallet => <section key={wallet.provider}><h3 className="font-bold">{wallet.provider === "SWILE" ? "Swile" : "Edenred"}</h3><BenefitWalletFundingDetails wallet={wallet} funding={funding[wallet.provider === "SWILE" ? "swile" : "edenred"]} /></section>)}</div>
  </details>;
}
