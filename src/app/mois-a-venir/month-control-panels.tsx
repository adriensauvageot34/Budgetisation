import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { MonthScenario } from "@/server/phase2/month-scenario";
import type { MonthControlCenterModel } from "@/server/phase2/month-control-center";
import { updateMonthInputs } from "./actions";
import { ResourceEditor } from "./resource-editor";
import { BenefitWalletEditor, BenefitWalletFunding } from "./benefit-wallet-editor";
import { MonthSavingsSection } from "./month-savings-section";
import { MonthAssumptionEditor, PreserveForecastButton } from "./month-decision-tools";
import material from "./month-material.module.css";

const money = (value: string | null) => value === null ? "À confirmer" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
const button = `${material.clayButton} px-4 py-2 text-sm font-bold`;
function Hidden({ month, intent, componentKey }: { month: string; intent: string; componentKey?: string }) {
  return <><input type="hidden" name="targetMonth" value={month} /><input type="hidden" name="intent" value={intent} />{componentKey && <input type="hidden" name="componentKey" value={componentKey} />}</>;
}
function Reset({ month, intent, componentKey, label }: { month: string; intent: string; componentKey: string; label: string }) {
  return <form action={updateMonthInputs}><Hidden month={month} intent={intent} componentKey={componentKey} /><button className="text-xs font-bold underline">{label}</button></form>;
}
const field = `${material.field} mt-1 w-full px-3 py-2 text-sm`;

export function MonthResourcesPanel({ forecast, scenario, model, today }: { forecast: MonthForecastSnapshot; scenario: MonthScenario; model: MonthControlCenterModel; today: string }) {
  const month = model.targetMonth, inputs = scenario.inputs, plan = scenario.economicPlan;
  return <div className="space-y-6"><header><h2 className="text-2xl font-black">Ressources & réserves</h2><p className="mt-2 text-sm text-slate-600">Revenus prévus, soldes déclarés et argent réservé gardent leurs rôles distincts.</p></header>
    <section data-control-focus="income"><h3 className="font-bold">Prévisions de revenus et de chargements</h3>
      {plan && <div className="mt-3 grid grid-cols-2 gap-3">{plan.resources.map(resource => <ResourceEditor key={resource.key} resource={resource} targetMonth={month} />)}</div>}
      {(inputs.declaredResources["benefit:swile"] === undefined || inputs.declaredResources["benefit:edenred"] === undefined) && <form action={updateMonthInputs} className={`${material.dataCard} mt-3 grid grid-cols-2 gap-3 p-4`}>
        <Hidden month={month} intent="declare-monthly-benefits" /><label className="text-sm">Chargement Swile du mois (€)<input className={field} name="swileResource" type="number" min="0" step="0.01" required defaultValue={inputs.declaredResources["benefit:swile"]} /></label>
        <label className="text-sm">Chargement Edenred du mois (€)<input className={field} name="edenredResource" type="number" min="0" step="0.01" required defaultValue={inputs.declaredResources["benefit:edenred"]} /></label>
        <p className="col-span-2 text-xs text-slate-600">Renseignez 0 € si aucun chargement n’est prévu. Les ressources d’un autre mois ne sont pas copiées.</p><button className={button}>Enregistrer les ressources de ce mois</button>
      </form>}
    </section>
    <section data-control-focus="BANK" className={`${material.glassSoft} p-4`}><h3 className="font-bold">Banque · solde actuel</h3>
      <p className="mt-2 text-sm">Disponible réel : <strong>{money(scenario.availableNow.value)}</strong>. Un solde daté est une information, pas une décision de dépense.</p>
      <form action={updateMonthInputs} className="mt-3 grid grid-cols-2 gap-3"><Hidden month={month} intent="save-bank-balance" />
        <label className="text-sm">Solde bancaire (€)<input className={field} name="openingAmount" type="number" step="0.01" defaultValue={inputs.openingBalance?.amount} /></label>
        <label className="text-sm">Date du solde<input className={field} name="openingDate" type="date" defaultValue={inputs.openingBalance?.asOfDate ?? today} /></label><button className={button}>Enregistrer le solde</button></form>
      {plan && <details className="mt-3 text-xs"><summary className="cursor-pointer font-bold">Disponible prévu et paiements restants</summary><dl className="mt-2 space-y-1">{([
        ["Réservation budgétaire des cagnottes", plan.bankCash.savingsBudgetReservation.amount], ["Disponible bancaire après cagnottes", plan.bankCash.afterSavings.amount],
        ["Revenus bancaires non reçus", plan.bankCash.futureKnownBankIncome.amount], ["Charges restant à débiter", plan.bankCash.remainingCertainBankOutflows.amount],
        ["Réalisations déclarées, débit non observé", plan.bankCash.pendingBankOutflows.amount], ["Paiements bancaires des projets", plan.bankCash.plannedBankCashRemaining.amount],
        ["Disponible prévu après projets", plan.bankCash.plannedAvailable.amount], ["Fin de mois bancaire", plan.bankCash.endOfMonth.central],
      ] as const).map(([label, amount]) => <div className="flex justify-between gap-4" key={label}><dt>{label}</dt><dd className="font-bold">{money(amount)}</dd></div>)}</dl>
        {plan.bankCash.limitations.includes("BANK_BALANCE_SAVINGS_SCOPE_UNRESOLVED") && <p className="mt-2">Le périmètre du solde ne précise pas si les cagnottes sont déjà exclues : aucun second retrait n’est inventé.</p>}
        <ul className="mt-2">{plan.bankCash.incomeOccurrences.map(row => <li key={row.key}>{plan.resources.find(resource => resource.key === row.key)?.label} : {money(row.amount)} · {row.state === "RECEIVED" ? "déjà reçu" : row.state === "EXPECTED" ? "encore attendu" : "à confirmer"}.</li>)}</ul>
      </details>}
    </section>
    <div className="grid grid-cols-2 gap-4">{Object.values(inputs.benefitWallets!).map(wallet => <div data-control-focus={wallet.provider} key={wallet.provider}>
      <BenefitWalletEditor wallet={wallet} projection={scenario.benefitWallets[wallet.provider]} targetMonth={month} today={today} /></div>)}</div>
    {plan && <BenefitWalletFunding wallets={plan.benefitWallets} funding={plan.plannedFunding} />}
    <div data-control-focus="savings"><MonthSavingsSection savings={plan?.savingsAllocations ?? { items: model.savings, total: null, protectedTotal: null, adjustableTotal: null }} targetMonth={month} controls /></div>
  </div>;
}

export function MonthSettingsPanel({ forecast, scenario, model }: { forecast: MonthForecastSnapshot; scenario: MonthScenario; model: MonthControlCenterModel }) {
  const month = model.targetMonth, inputs = scenario.inputs, parts = forecast.components.filter(part => part.key.startsWith("obligation:"));
  const conditional = parts.filter(part => part.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/iu.test(part.label));
  const fixed = parts.filter(part => part.nature === "CONTRACTUAL_EXPECTED" && part.additiveGroup === "obligations" && part.central !== null);
  return <div className="space-y-6"><header><h2 className="text-2xl font-black">Réglages du mois</h2><p className="mt-2 text-sm text-slate-600">Exceptions et hypothèses pour ce mois. Le retour à la référence reste possible.</p></header>
    <section><h3 className="font-bold">Nos hypothèses</h3>{model.categoryControls.map(row => <div data-control-focus={row.key} key={row.key}>
      <MonthAssumptionEditor categoryKey={row.key} label={row.label} capabilities={row.capabilities} targetMonth={month} settings={model.settings} /></div>)}</section>
    <section data-control-focus="obligations"><h3 className="font-bold">Charges conditionnelles</h3><div className="mt-3 space-y-3">{conditional.map(part => {
      const confirmed = inputs.confirmedObligations.find(row => row.componentKey === part.key), declined = inputs.declinedConditionalObligations.includes(part.key);
      return <article key={part.key} className={`${material.dataCard} p-4`}><h4 className="font-bold">{part.label}</h4><p className="mt-1 text-sm">{confirmed ? `Confirmée : ${money(confirmed.amount)} au ${confirmed.dueDate}` : declined ? "Non prévue ce mois" : "Prévue ce mois ?"}</p>
        <form action={updateMonthInputs} className="mt-3 flex items-end gap-3"><Hidden month={month} intent="confirm-obligation" componentKey={part.key} />
          <label className="text-xs">Montant confirmé (€)<input className={field} name="obligationAmount" type="number" min="0" step="0.01" required defaultValue={confirmed?.amount} /></label>
          <label className="text-xs">Date prévue<input className={field} name="obligationDate" type="date" required defaultValue={confirmed?.dueDate} min={`${month}-01`} max={new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)} /></label><button className={button}>Oui, prévu</button></form>
        <div className="mt-3 flex gap-4"><Reset month={month} intent="decline-conditional" componentKey={part.key} label="Non" /><Reset month={month} intent="unknown-conditional" componentKey={part.key} label="Je ne sais pas" /></div></article>;
    })}</div>
      <h3 className="mt-6 font-bold">Charges fixes et exceptions</h3><div className="mt-3 space-y-3">{fixed.map(part => {
        const excluded = inputs.excludedFixedObligations.includes(part.key), override = inputs.fixedAmountOverrides[part.key];
        return <article key={part.key} className={`${material.dataCard} p-4`}><h4 className="font-bold">{part.label}</h4><p className="mt-1 text-sm">{excluded ? "Retirée de ce mois" : `${money(override?.amount ?? part.central)} prévue${override ? " · exception du mois" : ""}`}</p>
          <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold">Modifier le montant pour ce mois</summary><form action={updateMonthInputs} className="mt-3 flex items-end gap-3"><Hidden month={month} intent="set-fixed-amount-override" componentKey={part.key} />
            <label className="text-xs">Montant (€)<input className={field} name="obligationAmount" type="number" min="0" step="0.01" defaultValue={override?.amount ?? part.central!} required /></label>
            <label className="text-xs">Date (facultative)<input className={field} name="obligationDate" type="date" defaultValue={override?.dueDate ?? ""} /></label><button className={button}>Enregistrer l’exception</button></form></details>
          <div className="mt-3 flex gap-4"><Reset month={month} intent={excluded ? "restore-fixed" : "exclude-fixed"} componentKey={part.key} label={excluded ? "Réintégrer ce mois" : "Retirer ce mois"} />
            {override && <Reset month={month} intent="clear-fixed-amount-override" componentKey={part.key} label="Revenir à la prévision" />}</div></article>;
      })}</div>
    </section>
  </div>;
}

export function MonthReliabilityPanel({ model }: { model: MonthControlCenterModel }) {
  const reliability = model.reliability;
  return <div className="space-y-6"><header><h2 className="text-2xl font-black">Fiabilité</h2><p className="mt-2 text-sm">Les incertitudes sont situées dans leur périmètre ; une information bancaire manquante n’efface pas les objectifs économiques.</p></header>
    <section className={`${material.dataCard} p-4`}><h3 className="font-bold">{reliability.modeLabel}</h3><p className="mt-2 text-sm">{reliability.modeExplanation}</p>
      <dl className="mt-3 space-y-2 text-sm"><div>Projection économique : <strong>{model.scopedReliability.economic === "USABLE" ? "exploitable" : model.scopedReliability.economic === "FRAGILE" ? "encore fragile" : "à compléter"}</strong></div>
        <div>Financement bancaire : <strong>{model.scopedReliability.bank === "USABLE" ? "exploitable" : "encore partiellement inconnu"}</strong></div>
        <div>Financement des titres-restaurants : <strong>{Object.values(model.scopedReliability.benefit).every(value => value === "USABLE") ? "exploitable" : "à préciser par carte"}</strong></div></dl>
    </section>
    <section data-control-focus="imports" className={`${material.glassSoft} p-4`}><h3 className="font-bold">Fraîcheur des données</h3><p className="mt-2 text-sm">Prévision calculée le {reliability.computedAt.slice(0, 10)}.</p>
      {reliability.importsMissing && <p className="mt-2 text-sm">Les imports récents sont incomplets. Les habitudes complètent l’estimation ; l’absence de données n’est pas un zéro.</p>}
      <a className="mt-3 inline-block text-xs font-bold underline" href="/imports">Ouvrir les imports</a></section>
    <section data-control-focus="history" className={`${material.glassSoft} p-4`}><h3 className="font-bold">Comment notre projection évolue</h3>
      {reliability.checkpoints.length ? <><ul className="mt-3 space-y-1 text-sm">{reliability.checkpoints.map((row, index) => <li key={`${row.date}:${index}`}>{row.date} · {money(row.central)}</li>)}</ul>
        {reliability.change && <><p className="mt-3 text-sm">{reliability.change.stability}</p><ul className="mt-2 text-sm">{reliability.change.visibleChanges.map(row => <li key={row.key}>{row.label} · {money(String(row.visible))}</li>)}</ul></>}</>
        : <p className="mt-3 text-sm">Aucune estimation comparable conservée pour ce mois.</p>}
      <p className="mt-3 text-xs text-slate-600">{reliability.calibrationAvailable ? "Les erreurs des mois terminés suffisamment documentés ajustent les estimations selon la méthode existante." : "Les références historiques restent utilisées, sans calibration personnelle suffisante."}</p>
      <PreserveForecastButton targetMonth={model.targetMonth} />
    </section>
    <details className="text-xs text-slate-600"><summary className="cursor-pointer font-bold">Détails techniques</summary><p className="mt-2">Mode : {reliability.mode} · Publication : {reliability.publicationId} · Révision : {reliability.revision}.</p>
      <p className="mt-2">Les méthodes et sources des catégories restent accessibles depuis leurs explications. Les scénarios de consommation sont réutilisés sans recalibrage.</p></details>
  </div>;
}
