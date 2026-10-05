"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { MonthControlModel } from "./month-control-center";
import type { MonthUpdateData } from "./month-control-update-contract";
export type { MonthUpdateData } from "./month-control-update-contract";
import { controlMoney as money, controlDate, controlMonth } from "@/domain/phase2/month-control-display";
import { useMonthLocalFocus } from "./month-control-focus";
import { CurrencyStepper, ControlFormFields, HumanDateField } from "./currency-stepper";
import { BenefitWalletFundingDetails } from "./benefit-wallet-editor";
import { updateMonthInputs } from "./actions";
import material from "./month-material.module.css";
import styles from "./month-control-center.module.css";

export function resourceFocusKey(key: string) { return `resource-${key.replace(/[^a-zA-Z0-9:-]/gu, "-")}`; }
const field = `${material.field} mt-2 block w-64 px-3 py-3`;
const save = `${material.clayPrimary} mt-6 px-5 py-3 font-bold`;
const UpdateTriageContext = createContext(false);
function UpdateSaveButton({ children }: { children: ReactNode }) { const triage = useContext(UpdateTriageContext); return <button type="submit" className={save}>{triage ? "Enregistrer et continuer" : children}</button>; }
function obligationState(row: MonthUpdateData["obligations"][number], inputs: MonthUpdateData["inputs"]) {
  const confirmed = inputs.confirmedObligations.find(item => item.componentKey === row.key), override = inputs.fixedAmountOverrides[row.key];
  return row.conditional ? confirmed ? { state: "YES", label: "Confirmé", amount: confirmed.amount, date: confirmed.dueDate } : inputs.declinedConditionalObligations.includes(row.key) ? { state: "NO", label: "Pas prévu ce mois-ci", amount: null, date: null } : { state: "UNKNOWN", label: "À confirmer", amount: null, date: null }
    : inputs.excludedFixedObligations.includes(row.key) ? { state: "ABSENT", label: "Pas payé ce mois-ci", amount: null, date: null } : override ? { state: "DIFFERENT", label: "Montant ajusté", amount: override.amount, date: override.dueDate } : { state: "EXPECTED", label: "Comme prévu", amount: row.amount, date: null };
}
export function MonthUpdateControls({ model, data, focus, back, triage = false, embedded = false }: { model: MonthControlModel; data: MonthUpdateData; focus?: string; back?: () => void; triage?: boolean; embedded?: boolean }) {
  const local = useMonthLocalFocus(), entity = focus ?? local.entity;
  const resource = data.resources.find(row => resourceFocusKey(row.key) === entity || entity === row.key || entity === `income:${row.key}`);
  const obligation = data.obligations.find(row => row.key === entity);
  const provider = entity === "SWILE" || entity === "EDENRED" ? entity : null;
  return <UpdateTriageContext.Provider value={triage}><div className={`${styles.focusPane} ${styles.factFocus}`} data-local-focus={entity}>
    {!embedded && <button type="button" className={styles.localBack} onClick={back ?? (() => local.openEntity("update"))}>← Mettre à jour</button>}
    {triage && !embedded && <p className={styles.triageCount}>{model.update.needsUpdateCount} information{model.update.needsUpdateCount > 1 ? "s" : ""} à actualiser</p>}
    {provider ? <WalletFocus key={provider} model={model} provider={provider} data={data} /> : entity === "BANK" ? <BankFocus model={model} data={data} /> : resource ? <IncomeFocus key={`${resource.key}:${resource.amount}`} model={model} resource={resource} /> : obligation ? <ObligationFocus key={`${obligation.key}:${JSON.stringify(obligationState(obligation, data.inputs))}`} model={model} row={obligation} inputs={data.inputs} /> : <p>Cette information n’est plus disponible.</p>}
  </div></UpdateTriageContext.Provider>;
}
function IncomeFocus({ model, resource }: { model: MonthControlModel; resource: MonthUpdateData["resources"][number] }) {
  const [amount, setAmount] = useState(resource.amount);
  return <section><h2 className="text-2xl font-black">{resource.label}</h2><p className="mt-3 text-slate-600">Prévision habituelle : {money(resource.sourceAmount, true)}</p><h3 className="mt-6 font-bold">Pour {controlMonth(model.targetMonth)}</h3>
    <form action={updateMonthInputs} className="mt-4"><ControlFormFields month={model.targetMonth} intent="set-resource-override" values={{ resourceKey: resource.key }} /><CurrencyStepper value={amount} onChange={setAmount} step={50} label={`le revenu ${resource.label}`} name="resourceAmount" /><UpdateSaveButton>Enregistrer</UpdateSaveButton></form>
    {resource.provenance === "MONTH_OVERRIDE" && <form action={updateMonthInputs} className="mt-6"><ControlFormFields month={model.targetMonth} intent="clear-resource-override" values={{ resourceKey: resource.key }} /><button className={styles.textAction}>Revenir au montant prévu</button></form>}
  </section>;
}
function BankFocus({ model, data }: { model: MonthControlModel; data: MonthUpdateData }) {
  const [detail, setDetail] = useState(false);
  return <section><h2 className="text-2xl font-black">Quel est votre solde bancaire aujourd’hui ?</h2><p className="mt-3 text-slate-600">Disponible bancaire aujourd’hui : {model.update.items.find(row => row.id === "BANK")?.status === "NEEDS_UPDATE" ? "À confirmer" : money(data.bank?.currentRealBankBalance.amount, true)}</p>{data.inputs.openingBalance && <p className="mt-3 text-slate-600">Dernière observation : <strong>{money(data.inputs.openingBalance.amount, true)}</strong> au {controlDate(data.inputs.openingBalance.asOfDate)}{model.update.items.find(row => row.id === "BANK")?.status === "NEEDS_UPDATE" && " · Mouvements récents à consolider"}</p>}
    {!detail ? <form action={updateMonthInputs} className="mt-6"><ControlFormFields month={model.targetMonth} intent="save-bank-balance" /><label className="font-semibold">Solde bancaire (€)<input className={field} name="openingAmount" type="number" step="0.01" required defaultValue={data.inputs.openingBalance?.amount ?? ""} /></label><HumanDateField name="openingDate" today={model.asOf} max={model.asOf} /><UpdateSaveButton>Enregistrer le solde</UpdateSaveButton></form> : <BankDetails bank={data.bank} />}
    <button type="button" className={`${styles.textAction} mt-6`} onClick={() => setDetail(!detail)}>{detail ? "Revenir au solde" : "Voir comment le disponible est calculé"}</button>
  </section>;
}
function BankDetails({ bank }: { bank: MonthUpdateData["bank"] }) {
  if (!bank) return <p className="mt-5">Les ressources du mois ne sont pas encore complètes.</p>;
  return <dl className="mt-6 space-y-4">{([ ["Disponible après cagnottes", bank.afterSavings.amount], ["Charges restant à débiter", bank.remainingCertainBankOutflows.amount], ["Paiements des projets", bank.plannedBankCashRemaining.amount], ["Fin de mois bancaire", bank.endOfMonth.central] ] as const).map(([label, amount]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="font-bold">{money(amount, true)}</dd></div>)}<p className="text-sm text-slate-600">Le disponible bancaire, le coût économique et les titres-restaurants restent distincts.</p></dl>;
}
function WalletFocus({ model, provider, data }: { model: MonthControlModel; provider: "SWILE" | "EDENRED"; data: MonthUpdateData }) {
  const [editor, setEditor] = useState<"NONE" | "BALANCE" | "LOADING" | "FUNDING" | "OBSERVATIONS">(model.update.groups.NEEDS_UPDATE.some(row => row.id === provider) && model.resourceInputs.projections[provider].currentBalanceKnowledge.amount !== null ? "LOADING" : "BALANCE");
  const wallet = model.resourceInputs.wallets[provider], projection = model.resourceInputs.projections[provider], label = provider === "SWILE" ? "Swile" : "Edenred";
  return <section data-wallet-focus={provider}><header className={styles.walletHeader}><h2 className="text-2xl font-black">{label}</h2>
    <div className="mt-6 flex flex-wrap gap-3">{([["BALANCE", "Solde"], ["LOADING", "Chargement"], ["FUNDING", "Financement"]] as const).map(([key, title]) => <button type="button" key={key} aria-pressed={editor === key} className={`${material.clayChip} px-4 py-3 font-bold`} onClick={() => setEditor(key)}>{title}</button>)}</div></header>
    {editor === "NONE" && <dl className="mt-7 space-y-5"><div><dt className="text-sm text-slate-600">Solde actuel</dt><dd className="mt-1 text-xl font-bold">{money(projection.currentBalanceKnowledge.amount, true)}</dd></div><div><dt className="text-sm text-slate-600">Chargement de {controlMonth(model.targetMonth)}</dt><dd className="mt-1 text-xl font-bold">{money(projection.expectedLoading?.amount, true)}</dd></div><div><dt className="text-sm text-slate-600">Peut encore financer</dt><dd className="mt-1 text-xl font-bold">{money(projection.usableCapacity, true)}</dd></div><p className="text-sm text-slate-600">Le chargement est un flux prévu ; il n’est jamais confondu avec le solde actuel.</p></dl>}
    {editor === "BALANCE" && <WalletBalanceForm key={`${projection.currentBalanceKnowledge.amount}:${wallet.balanceObservations.length}`} model={model} provider={provider} />}
    {editor === "LOADING" && <WalletLoadingForm key={`${projection.expectedLoading?.amount}:${projection.expectedLoading?.expectedDate}`} model={model} provider={provider} />}
    {editor === "FUNDING" && (data.funding ? <div className="mt-6"><h3 className="mb-4 text-lg font-bold">Ce que {label} peut encore financer</h3><BenefitWalletFundingDetails wallet={projection} funding={data.funding[provider === "SWILE" ? "swile" : "edenred"]} /></div> : <p className="mt-6">Complétez les chargements du mois pour estimer le financement. Aucun montant inconnu n’est inventé.</p>)}
    {editor === "OBSERVATIONS" && <div className="mt-6"><h3 className="font-bold">Soldes déclarés</h3>{wallet.balanceObservations.map(row => <div key={row.id} className={styles.controlRow}><span>{money(row.amount, true)} · {controlDate(row.asOfDate)}</span><form action={updateMonthInputs}><ControlFormFields month={model.targetMonth} intent="remove-wallet-balance-observation" values={{ provider, observationId: row.id }} /><button className={styles.textAction}>Supprimer cette observation</button></form></div>)}</div>}
    {wallet.balanceObservations.length > 0 && <button type="button" className={`${styles.textAction} mt-7`} onClick={() => setEditor("OBSERVATIONS")}>Voir les soldes déclarés</button>}
  </section>;
}
export function WalletBalanceForm({ model, provider }: { model: MonthControlModel; provider: "SWILE" | "EDENRED" }) {
  const label = provider === "SWILE" ? "Swile" : "Edenred";
  return <form action={updateMonthInputs} className="mt-7" data-wallet-editor="BALANCE"><ControlFormFields month={model.targetMonth} intent="add-wallet-balance-observation" values={{ provider }} /><label className="text-lg font-bold">Quel est votre solde {label} aujourd’hui ?<input className={field} name="walletBalanceAmount" type="number" min="0" max="999999999.99" step="0.01" required defaultValue={model.resourceInputs.projections[provider].currentBalanceKnowledge.amount ?? ""} /></label>
    <HumanDateField name="walletBalanceDate" today={model.asOf} max={model.asOf} /><label className="mt-5 flex items-center gap-2 text-sm"><input type="checkbox" name="walletOpeningObservation" />Ce solde vient d’un mois précédent</label><p className="mt-3 text-sm text-slate-600">À la même date, cette saisie corrige le solde déclaré. Les autres dates sont conservées.</p><UpdateSaveButton>Enregistrer le solde {label}</UpdateSaveButton></form>;
}
export function WalletLoadingForm({ model, provider }: { model: MonthControlModel; provider: "SWILE" | "EDENRED" }) {
  const label = provider === "SWILE" ? "Swile" : "Edenred", loading = model.resourceInputs.projections[provider].expectedLoading;
  const [amount, setAmount] = useState(loading?.amount ?? "0.00");
  return <div className="mt-7" data-wallet-editor="LOADING"><h3 className="text-lg font-bold">Chargement {label} de {controlMonth(model.targetMonth)}</h3><form action={updateMonthInputs} className="mt-5"><ControlFormFields month={model.targetMonth} intent="save-wallet-expected-loading" values={{ provider }} /><CurrencyStepper value={amount} onChange={setAmount} step={10} label={`le chargement ${label}`} name="walletLoadingAmount" /><HumanDateField optional name="walletLoadingDate" label="Date prévue" initial={loading?.expectedDate} today={model.asOf} min={`${model.targetMonth}-01`} max={new Date(Date.UTC(Number(model.targetMonth.slice(0, 4)), Number(model.targetMonth.slice(5)), 0)).toISOString().slice(0, 10)} /><UpdateSaveButton>Enregistrer le chargement</UpdateSaveButton></form>
    {loading && <form action={updateMonthInputs} className="mt-7"><ControlFormFields month={model.targetMonth} intent="clear-wallet-expected-loading" values={{ provider }} /><button className={styles.textAction}>Retirer ce chargement prévu</button></form>}</div>;
}
function ObligationFocus({ model, row, inputs }: { model: MonthControlModel; row: MonthUpdateData["obligations"][number]; inputs: MonthUpdateData["inputs"] }) {
  const current = obligationState(row, inputs), [state, setState] = useState(current.state);
  const intent = row.conditional ? state === "YES" ? "confirm-obligation" : state === "NO" ? "decline-conditional" : "unknown-conditional" : "set-month-fixed-state";
  return <section><h2 className="text-2xl font-black">{row.label}</h2><p className="mt-3 text-slate-600">{row.conditional ? `${current.label}${current.amount ? ` · ${money(current.amount, true)}` : ""}${current.date ? ` · ${controlDate(current.date)}` : ""}` : `Habituellement : ${money(row.amount, true)} · ${current.label}`}</p>
    <h3 className="mt-6 font-bold">{row.conditional ? "Est-ce prévu ce mois-ci ?" : `Pour ${controlMonth(model.targetMonth)}`}</h3><form action={updateMonthInputs} className="mt-4"><ControlFormFields month={model.targetMonth} intent={intent} values={{ componentKey: row.key, fixedState: state }} />
      <div className="flex flex-wrap gap-3">{(row.conditional ? [["YES", "Oui"], ["NO", "Non"], ["UNKNOWN", "Pas sûr"]] : [["EXPECTED", "Comme prévu"], ["ABSENT", "Pas ce mois-ci"], ["DIFFERENT", "Montant différent"]]).map(([key, label]) => <button key={key} type="button" aria-pressed={state === key} className={`${material.clayChip} px-4 py-3 font-bold`} onClick={() => setState(key)}>{label}</button>)}</div>
      {(state === "YES" || state === "DIFFERENT") && <div className="mt-6"><label className="font-semibold">Montant pour ce mois (€)<input className={field} name="obligationAmount" type="number" min="0" step="0.01" required defaultValue={current.amount ?? row.amount ?? ""} /></label>
        {row.conditional ? <label className="mt-5 block font-semibold">Date prévue<input className={field} name="obligationDate" type="date" required defaultValue={current.date ?? ""} min={`${model.targetMonth}-01`} max={new Date(Date.UTC(Number(model.targetMonth.slice(0, 4)), Number(model.targetMonth.slice(5)), 0)).toISOString().slice(0, 10)} /></label> : <HumanDateField optional name="obligationDate" label="Date corrigée" initial={current.date} today={model.asOf} />}</div>}
      <UpdateSaveButton>Enregistrer pour ce mois</UpdateSaveButton></form>
  </section>;
}
