import type { MonthForecastSnapshot } from "@/server/phase2/month-forecast-snapshot";
import type { MonthScenario } from "@/server/phase2/month-scenario";
import type { MonthControlCenterModel } from "@/server/phase2/month-control-center";
import { updateMonthInputs } from "./actions";
import { ResourceEditor } from "./resource-editor";
import { BenefitWalletEditor } from "./benefit-wallet-editor";
import { MonthSavingsSection } from "./month-savings-section";
import { MonthAssumptionEditor, PreserveForecastButton } from "./month-decision-tools";
import { controlDate, controlResourceLabel } from "@/domain/phase2/month-control-display";
import material from "./month-material.module.css";

const money = (value: string | null) => value === null ? "À confirmer" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
const button = `${material.clayButton} px-4 py-2 text-sm font-bold`;
function Hidden({ month, intent, componentKey }: { month: string; intent: string; componentKey?: string }) {
  return <><input type="hidden" name="targetMonth" value={month} /><input type="hidden" name="intent" value={intent} />{componentKey && <input type="hidden" name="componentKey" value={componentKey} />}</>;
}
function Reset({ month, intent, componentKey, label }: { month: string; intent: string; componentKey: string; label: string }) {
  return <form action={updateMonthInputs}><Hidden month={month} intent={intent} componentKey={componentKey} /><button className="text-sm font-bold underline">{label}</button></form>;
}
const field = `${material.field} mt-1 w-full px-3 py-2 text-sm`;

export function MonthResourcesPanel({ forecast, scenario, model, today }: { forecast: MonthForecastSnapshot; scenario: MonthScenario; model: MonthControlCenterModel; today: string }) {
  const month = model.targetMonth, inputs = scenario.inputs, plan = scenario.economicPlan;
  return <div className="space-y-6"><header><h2 className="text-2xl font-black">Ressources & réserves</h2><p className="mt-2 text-sm text-slate-600">Revenus prévus, soldes déclarés et argent réservé gardent leurs rôles distincts.</p></header>
    {plan && <section data-control-focus="income"><h3 className="font-bold">Revenus prévus</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">{plan.resources.filter(resource => resource.pocket === "BANK_CASH").map(resource => <ResourceEditor key={resource.key} resource={resource} targetMonth={month} />)}</div>
    </section>}
    <section data-control-focus="BANK" className={`${material.glassSoft} p-4`}><h3 className="font-bold">Banque · solde actuel</h3>
      <p className="mt-2 text-sm">Disponible réel : <strong>{money(scenario.availableNow.value)}</strong>. Un solde daté est une information, pas une décision de dépense.</p>
      <form action={updateMonthInputs} className="mt-3 flex items-end gap-3"><Hidden month={month} intent="save-bank-balance" />
        <label className="text-sm">Solde bancaire (€)<input className={field} name="openingAmount" type="number" step="0.01" defaultValue={inputs.openingBalance?.amount} /></label>
        <label className="text-sm">Date du solde<input className={field} name="openingDate" type="date" defaultValue={inputs.openingBalance?.asOfDate ?? today} /></label><button className={button}>Mettre à jour</button></form>
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
      <BenefitWalletEditor wallet={wallet} projection={scenario.benefitWallets[wallet.provider]} targetMonth={month} today={today} funding={plan?.plannedFunding[wallet.provider === "SWILE" ? "swile" : "edenred"]} /></div>)}</div>
    <p className="text-sm text-slate-600">Ce que vos cartes peuvent encore financer est détaillé dans chaque carte. Les titres-restaurants restent distincts du disponible bancaire.</p>
    <div data-control-focus="savings"><MonthSavingsSection savings={plan?.savingsAllocations ?? { items: model.savings, total: null, protectedTotal: null, adjustableTotal: null }} targetMonth={month} controls /></div>
  </div>;
}

export function MonthSettingsPanel({ forecast, scenario, model }: { forecast: MonthForecastSnapshot; scenario: MonthScenario; model: MonthControlCenterModel }) {
  const month = model.targetMonth, inputs = scenario.inputs, parts = forecast.components.filter(part => part.key.startsWith("obligation:"));
  const conditional = parts.filter(part => part.knowledgeState === "CONDITIONAL_UNKNOWN" && /Ornikar|Alma/iu.test(part.label));
  const fixed = parts.filter(part => part.nature === "CONTRACTUAL_EXPECTED" && part.additiveGroup === "obligations" && part.central !== null);
  const active = (key: string) => inputs.confirmedObligations.some(row => row.componentKey === key) || inputs.declinedConditionalObligations.includes(key)
    || inputs.excludedFixedObligations.includes(key) || !!inputs.fixedAmountOverrides[key];
  const assumption = (row: MonthControlCenterModel["categoryControls"][number]) => <div data-control-focus={row.key} key={row.key}><MonthAssumptionEditor categoryKey={row.key} label={row.label} capabilities={row.capabilities} targetMonth={month} settings={model.settings} /></div>;
  const conditionalCard = (part: typeof conditional[number]) => {
    const confirmed = inputs.confirmedObligations.find(row => row.componentKey === part.key), declined = inputs.declinedConditionalObligations.includes(part.key), resolved = !!confirmed || declined;
    const form = <><form action={updateMonthInputs} className="mt-3 flex items-end gap-3"><Hidden month={month} intent="confirm-obligation" componentKey={part.key} />
      <label className="text-sm">Montant confirmé (€)<input className={field} name="obligationAmount" type="number" min="0" step="0.01" required defaultValue={confirmed?.amount} /></label>
      <label className="text-sm">Date prévue<input className={field} name="obligationDate" type="date" required defaultValue={confirmed?.dueDate} min={`${month}-01`} max={new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)} /></label><button className={button}>{resolved ? "Enregistrer" : "Oui, prévu"}</button></form>
      <div className="mt-3 flex gap-4"><Reset month={month} intent="decline-conditional" componentKey={part.key} label="Non prévue ce mois" />{!resolved && <Reset month={month} intent="unknown-conditional" componentKey={part.key} label="Je ne sais pas" />}</div></>;
    return <article data-control-focus={part.key} data-obligation-state={confirmed ? "CONFIRMED" : declined ? "DECLINED" : "UNKNOWN"} key={part.key} className="border-b border-violet-100 py-3"><h4 className="font-bold">{controlResourceLabel(part.label)}</h4>
      <p className="mt-1 text-sm text-slate-600">{confirmed ? `Confirmée · ${money(confirmed.amount)} · ${controlDate(confirmed.dueDate)}` : declined ? "Non prévue ce mois" : "Prévue ce mois ?"}</p>
      {resolved ? <><details className="mt-2 text-sm"><summary className="cursor-pointer font-bold text-violet-900">Modifier</summary>{form}</details><div className="mt-2"><Reset month={month} intent="unknown-conditional" componentKey={part.key} label={confirmed ? "Annuler la confirmation" : "Revenir à Je ne sais pas"} /></div></> : form}
    </article>;
  };
  const fixedCard = (part: typeof fixed[number]) => {
    const excluded = inputs.excludedFixedObligations.includes(part.key), override = inputs.fixedAmountOverrides[part.key];
    return <article data-control-focus={part.key} key={part.key} className="border-b border-violet-100 py-3"><h4 className="font-bold">{controlResourceLabel(part.label)}</h4><p className="mt-1 text-sm text-slate-600">{excluded ? "Retirée de ce mois" : `${money(override?.amount ?? part.central)} prévue${override ? " · ajustée pour ce mois" : ""}`}{override?.dueDate && ` · ${controlDate(override.dueDate)}`}</p>
      <details className="mt-2 text-sm"><summary className="cursor-pointer font-bold text-violet-900">Modifier</summary><form action={updateMonthInputs} className="mt-3 flex items-end gap-3"><Hidden month={month} intent="set-fixed-amount-override" componentKey={part.key} />
        <label>Montant (€)<input className={field} name="obligationAmount" type="number" min="0" step="0.01" defaultValue={override?.amount ?? part.central!} required /></label>
        <label>Date (facultative)<input className={field} name="obligationDate" type="date" defaultValue={override?.dueDate ?? ""} /></label><button className={button}>Enregistrer</button></form>
        {!excluded && <div className="mt-2"><Reset month={month} intent="exclude-fixed" componentKey={part.key} label="Retirer ce mois" /></div>}
      </details><div className="mt-2 flex gap-4">{excluded && <Reset month={month} intent="restore-fixed" componentKey={part.key} label="Rétablir" />}{override && <Reset month={month} intent="clear-fixed-amount-override" componentKey={part.key} label="Rétablir la prévision" />}</div>
    </article>;
  };
  const activeConditional = conditional.filter(part => active(part.key)), activeFixed = fixed.filter(part => active(part.key));
  const personal = model.categoryControls.filter(row => model.settings.assumptions[row.key]), defaults = model.categoryControls.filter(row => !model.settings.assumptions[row.key] && row.capabilities.adjustability === "ADJUSTABLE");
  return <div className="space-y-6"><header><h2 className="text-2xl font-black">Hypothèses & exceptions</h2><p className="mt-2 max-w-prose text-sm text-slate-600">Ce que vous avez décidé pour ce mois. Les habitudes historiques restent la référence tant qu’aucun ajustement n’est enregistré.</p></header>
    <section><h3 className="text-lg font-bold">Hypothèses personnalisées</h3>{personal.length ? personal.map(assumption) : <p className="mt-2 text-sm text-slate-600">Aucune. Les habitudes historiques servent actuellement de référence.</p>}
      {defaults.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold text-violet-900">Ajuster une catégorie</summary>{defaults.map(assumption)}</details>}</section>
    <section data-control-focus="obligations"><h3 className="text-lg font-bold">Exceptions actives</h3>{activeConditional.length + activeFixed.length > 0 ? <div className="mt-2">{activeConditional.map(conditionalCard)}{activeFixed.map(fixedCard)}</div> : <p className="mt-2 text-sm text-slate-600">Aucune exception enregistrée pour ce mois.</p>}
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-bold text-violet-900">Modifier une autre charge</summary><div className="mt-3">{conditional.filter(part => !active(part.key)).map(conditionalCard)}{fixed.filter(part => !active(part.key)).map(fixedCard)}</div></details>
    </section>
  </div>;
}

export function MonthReliabilityPanel({ model }: { model: MonthControlCenterModel }) {
  const reliability = model.reliability;
  const economicReasons = model.rootCauses.filter(row => row.scopes.includes("ECONOMIC_MONTH") && row.priority !== "INFORMATIONAL");
  const bankMissing = model.rootCauses.some(row => row.key === "bank-balance"), cards = model.rootCauses.filter(row => row.key.startsWith("wallet:"));
  return <div className="space-y-6"><header><h2 className="text-2xl font-black">Données & fiabilité</h2><p className="mt-2 max-w-prose text-sm text-slate-600">Ce que les données permettent d’estimer, et ce qui reste à préciser.</p></header>
    <section data-control-focus="imports"><h3 className="font-bold">Prévision du mois</h3><p className="mt-2 text-sm"><strong>{model.scopedReliability.economic === "USABLE" ? "Exploitable" : "À consolider"}</strong>{economicReasons.length > 0 && ` — ${economicReasons.map(row => row.label.toLocaleLowerCase("fr-FR")).join(" · ")}`}</p>
      {reliability.importsMissing && <p className="mt-2 max-w-prose text-sm text-slate-600">Les imports récents sont incomplets. Les habitudes connues complètent donc le mois.</p>}<p className="mt-2 text-sm text-slate-600">Prévision calculée le {controlDate(reliability.computedAt, true)}.</p><a className="mt-2 inline-block text-sm font-bold text-violet-900 underline" href="/imports">Voir les imports</a></section>
    <section><h3 className="font-bold">Disponible bancaire</h3><p className="mt-2 text-sm">{model.scopedReliability.bank === "USABLE" ? "Exploitable avec le solde daté renseigné." : bankMissing ? "À préciser — solde actuel absent ou insuffisamment daté." : "À préciser — certains paiements ou financements restent inconnus."}</p></section>
    <section><h3 className="font-bold">Titres-restaurants</h3><p className="mt-2 text-sm">{cards.length ? `${cards.map(row => row.label).join(" · ")}. Les soldes et chargements sont distincts.` : "Les informations des cartes permettent d’estimer le financement des repas."}</p>{cards.length > 0 && <ul className="mt-2 space-y-1 text-sm text-slate-600">{cards.map(row => <li key={row.key}>{row.key === "wallet:SWILE" ? "Swile" : "Edenred"} : {row.symptoms.map(value => value.replace("Stock actuel à confirmer", "Solde actuel à renseigner").replace("Propriétaire canonique non résolu", "Titulaire de la carte à confirmer")).join(" · ")}</li>)}</ul>}</section>
    <section className={`${material.glassSoft} p-4`}><h3 className="font-bold">Mode de prévision</h3><p className="mt-2 text-sm font-semibold">{reliability.modeLabel}</p><p className="mt-1 max-w-prose text-sm text-slate-600">{reliability.modeExplanation}</p></section>
    <details data-control-focus="history" className="text-sm"><summary className="cursor-pointer font-bold">Historique des estimations</summary>
      {reliability.checkpoints.length ? <><ul className="mt-3 space-y-1">{reliability.checkpoints.map((row, index) => <li key={`${row.date}:${index}`}>{controlDate(row.date, true)} · ≈ {money(row.central)}</li>)}</ul>
        {reliability.change && <ul className="mt-3 space-y-1">{reliability.change.visibleChanges.map(row => <li key={row.key}>{row.label} · {money(String(row.visible))}</li>)}</ul>}</>
        : <p className="mt-3 text-slate-600">Aucune estimation comparable conservée pour ce mois.</p>}
      <p className="mt-3 text-slate-600">{reliability.calibrationAvailable ? "Les mois terminés suffisamment documentés permettent d’ajuster les estimations selon la méthode existante." : "Les références historiques restent utilisées ; le recul personnel n’est pas encore suffisant pour les ajuster."}</p><PreserveForecastButton targetMonth={model.targetMonth} />
    </details><a className="inline-block text-sm font-bold text-violet-900 underline" href="/diagnostic">Voir le diagnostic</a>
  </div>;
}
