"use client";
import { useState } from "react";
import type { MonthControlModel } from "./month-control-center";
import { useMonthLocalFocus, ControlBack } from "./month-control-focus";
import { CurrencyStepper, ControlFormFields, HumanDateField } from "./currency-stepper";
import { MonthAssumptionEditor } from "./month-decision-tools";
import { updateMonthInputs } from "./actions";
import { controlMoney as money, controlMonth } from "@/domain/phase2/month-control-display";
import material from "./month-material.module.css";
import styles from "./month-control-center.module.css";

export function MonthControlLimits({ model }: { model: MonthControlModel }) {
  const { openEntity } = useMonthLocalFocus();
  return <section aria-label="Mes limites" className={styles.choiceSection}><h3 className="text-xl font-black">Mes limites</h3><div className="mt-4 grid grid-cols-2 gap-x-7">
    {model.categoryControls.filter(row => row.capabilities.targetAllowed).map(row => <button type="button" key={row.key} className={styles.controlRow} onClick={() => openEntity(`category:${row.key}`)}><span><strong>{row.label}</strong><span className="mt-1 block text-sm text-slate-600">Prévu ce mois ≈ {money(row.forecast)} · Déjà réalisé {money(row.realized, true)}</span><span className="mt-1 block text-sm">Votre limite : {row.target === null ? "Pas encore définie" : money(row.target, true)}</span>{row.capabilities.adjustability === "FIXED" && <span className="mt-1 block text-sm text-slate-600">Suivi uniquement</span>}</span><span className="text-sm font-bold text-violet-900">{row.target === null ? "Fixer une limite" : "Modifier"} →</span></button>)}
  </div><button type="button" className={styles.controlRow} onClick={() => openEntity("global-goal")}><span><strong>Combien garder en fin de mois ?</strong><span className="mt-1 block text-sm">{model.settings.goal === null ? "Pas encore d’objectif" : `${money(model.settings.goal, true)} · ${model.projectionSummary.globalSatisfied ? "✓ Objectif atteint" : `Il manque ≈ ${money(model.projectionSummary.globalGap)}`}`}</span></span><span className="font-bold text-violet-900">{model.settings.goal === null ? "Définir" : "Modifier"} →</span></button></section>;
}

export function MonthControlActiveChoices({ model }: { model: MonthControlModel }) {
  const { openEntity } = useMonthLocalFocus();
  const [adding, setAdding] = useState(false);
  const active = model.categoryControls.filter(row => model.settings.assumptions[row.key]);
  return <section aria-label="Mes choix actifs" className={styles.choiceSection}><h3 className="text-xl font-black">Mes choix pour {controlMonth(model.targetMonth)}</h3>
    {!active.length && <p className="mt-3 text-sm text-slate-600">Comme d’habitude pour l’instant. Un scénario devient un choix actif seulement après application.</p>}
    {active.map(row => { const setting = model.settings.assumptions[row.key]!; return <div key={row.key} className={styles.controlRow}><div><strong>{row.label}</strong><p className="mt-1 text-sm">{setting.mode === "CUSTOM" ? setting.amount === "0.00" || setting.amount === "0" ? "Plus rien de prévu pour le reste du mois" : `Reste prévu fixé à ${money(setting.amount, true)}` : setting.mode === "LOWER" ? "20 % de moins que d’habitude" : "20 % de plus que d’habitude"}</p></div><div className="flex gap-4"><button type="button" className={styles.textAction} onClick={() => openEntity(`choice:${row.key}`)}>Modifier</button><form action={updateMonthInputs}><ControlFormFields month={model.targetMonth} intent="clear-month-assumption" values={{ categoryKey: row.key }} /><button className={styles.textAction}>Revenir comme d’habitude</button></form></div></div>; })}
    <button type="button" className={`${material.clayButton} mt-3 px-4 py-2 text-sm font-bold`} onClick={() => setAdding(!adding)}>Modifier une autre habitude</button>
    {adding && <div className="mt-3 flex flex-wrap gap-2">{model.categoryControls.filter(row => row.capabilities.adjustability === "ADJUSTABLE" && !model.settings.assumptions[row.key]).map(row => <button key={row.key} type="button" className={`${material.clayChip} px-4 py-2`} onClick={() => openEntity(`choice:${row.key}`)}>{row.label}</button>)}</div>}
  </section>;
}
export function MonthControlSavings({ model }: { model: MonthControlModel }) {
  const { openEntity } = useMonthLocalFocus();
  return <section data-control-focus="savings" aria-label="Ce qu’on met de côté" className={styles.choiceSection}><h3 className="text-xl font-black">Ce qu’on met de côté</h3>
    {model.savings.length === 0 && <p className="mt-3 text-sm text-slate-600">Aucune cagnotte affectée à ce mois.</p>}
    {model.savings.map(row => <button type="button" key={row.id} className={styles.controlRow} onClick={() => openEntity(`savings:${row.id}`)}><span><strong>{row.adjustability === "PROTECTED" ? "🔒 " : ""}{row.label}</strong><span className="mt-1 block text-sm text-slate-600">{row.adjustability === "PROTECTED" ? "Protégée des ajustements automatiques" : "Ajustable"}</span></span><span className="text-lg font-bold">{money(row.amount, true)} <span className="ml-4 text-sm text-violet-900">Modifier →</span></span></button>)}
    <button type="button" className={`${material.clayButton} mt-3 px-4 py-2 font-bold`} onClick={() => openEntity("savings:new")}>Ajouter une cagnotte</button></section>;
}

export function MonthChoiceFocus({ model }: { model: MonthControlModel }) {
  const { entity } = useMonthLocalFocus();
  const category = model.categoryControls.find(row => row.capabilities.targetAllowed && entity === `category:${row.key}`), choice = model.categoryControls.find(row => entity === `choice:${row.key}`);
  const saving = model.savings.find(row => entity === `savings:${row.id}` || entity === `reserve-${model.savings.indexOf(row) + 1}`);
  return <div className={`${styles.focusPane} ${styles.choiceFocus}`} data-local-focus={entity}><ControlBack label="Mes choix" />
    {category ? <TargetFocus key={`${category.key}:${category.target}`} model={model} category={category} /> : entity === "global-goal" ? <GoalFocus key={model.settings.goal} model={model} />
      : choice ? <MonthAssumptionEditor categoryKey={choice.key} label={choice.label} targetMonth={model.targetMonth} settings={model.settings} capabilities={choice.capabilities} />
      : saving || entity === "savings:new" ? <SavingsFocus key={`${saving?.id}:${saving?.amount}:${saving?.adjustability}`} model={model} saving={saving} /> : <p>Choisissez un élément à modifier.</p>}
  </div>;
}
function TargetFocus({ model, category }: { model: MonthControlModel; category: MonthControlModel["categoryControls"][number] }) {
  const [value, setValue] = useState(category.target ?? category.forecast);
  return <section><h2 className="text-2xl font-black">Votre limite · {category.label}</h2><p className="mt-3 text-slate-600">≈ {money(category.forecast)} prévus · {money(category.realized, true)} déjà réalisés</p>
    {category.capabilities.adjustability === "FIXED" && <p className="mt-3">Suivi uniquement : ce poste n’est pas utilisé comme levier automatique.</p>}
    <form action={updateMonthInputs} className="mt-6 space-y-6"><ControlFormFields month={model.targetMonth} intent="save-category-target" values={{ categoryKey: category.key }} /><CurrencyStepper label={`l’objectif ${category.label}`} name="categoryTarget" value={value} onChange={setValue} percent />
      <button className={`${material.clayPrimary} px-5 py-3 font-bold`}>Enregistrer la limite</button></form>
    {category.target !== null && <form action={updateMonthInputs} className="mt-5"><ControlFormFields month={model.targetMonth} intent="clear-category-target" values={{ categoryKey: category.key }} /><button className={styles.textAction}>Retirer cette limite</button></form>}
  </section>;
}
function GoalFocus({ model }: { model: MonthControlModel }) {
  const [value, setValue] = useState(model.settings.goal ?? (Number(model.projectionSummary.economic?.central) > 0 ? model.projectionSummary.economic!.central : "0.00"));
  return <section><h2 className="text-2xl font-black">Combien souhaitez-vous garder à la fin du mois ?</h2><p className="mt-3 text-slate-600">Projection actuelle : ≈ {money(model.projectionSummary.economic?.central)}</p>
    <form action={updateMonthInputs} className="mt-6 space-y-6"><ControlFormFields month={model.targetMonth} intent="save-month-goal" /><CurrencyStepper value={value} onChange={setValue} step={50} label="l’objectif de fin de mois" name="monthGoal" /><button className={`${material.clayPrimary} px-5 py-3 font-bold`}>Enregistrer l’objectif</button></form>
    {model.settings.goal !== null && <><p className="mt-5 font-bold">{model.projectionSummary.globalSatisfied ? "✓ Objectif atteint" : `Il manque ≈ ${money(model.projectionSummary.globalGap)}`}</p><form action={updateMonthInputs} className="mt-4"><ControlFormFields month={model.targetMonth} intent="clear-month-goal" /><button className={styles.textAction}>Retirer l’objectif</button></form></>}
  </section>;
}
function SavingsFocus({ model, saving }: { model: MonthControlModel; saving?: MonthControlModel["savings"][number] }) {
  const [amount, setAmount] = useState(saving?.amount ?? "0.00"), [protection, setProtection] = useState(saving?.adjustability ?? "PROTECTED"), [options, setOptions] = useState(false);
  return <section><h2 className="text-2xl font-black">{saving?.label ?? "Une nouvelle cagnotte"}</h2><p className="mt-3 text-slate-600">De l’argent réservé pour un projet, qui reste à vous.</p>
    <form action={updateMonthInputs} className="mt-6 space-y-6"><ControlFormFields month={model.targetMonth} intent={saving ? "update-declared-savings" : "add-declared-savings"} values={{ ...(saving ? { outflowId: saving.id } : {}), outflowAdjustability: protection }} />
      <label className="block font-semibold">Pour quoi ?<input className={`${material.field} ml-3 px-3 py-2`} name="outflowLabel" required maxLength={120} defaultValue={saving?.label} placeholder="Voyage, Noël…" /></label>
      <CurrencyStepper value={amount} onChange={setAmount} step={50} label={`la cagnotte ${saving?.label ?? "à créer"}`} name="outflowAmount" />
      <div className="flex gap-3">{(["PROTECTED", "ADJUSTABLE"] as const).map(key => <button type="button" key={key} aria-pressed={protection === key} className={`${material.clayChip} px-4 py-3 font-bold`} onClick={() => setProtection(key)}>{key === "PROTECTED" ? "🔒 Protégée" : "Ajustable"}</button>)}</div>
      <p className="text-sm text-slate-600">Une cagnotte protégée n’est jamais utilisée dans les suggestions de compensation.</p>
      <HumanDateField optional name="outflowDate" label="Date de mise de côté" today={model.asOf} initial={saving?.dueDate} />
      <button className={`${material.clayPrimary} px-5 py-3 font-bold`}>Confirmer la cagnotte</button></form>
    {saving && <div className="mt-8 border-t border-violet-100 pt-5"><button type="button" className={styles.textAction} onClick={() => setOptions(!options)}>Plus d’options</button>{options && <form action={updateMonthInputs} className="mt-4"><ControlFormFields month={model.targetMonth} intent="remove-declared-outflow" values={{ outflowId: saving.id }} /><button className="text-sm font-semibold text-rose-800 underline">Supprimer cette cagnotte</button></form>}</div>}
  </section>;
}
