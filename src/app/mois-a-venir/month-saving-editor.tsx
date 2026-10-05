"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MonthControlModel } from "./month-control-center";
import { previewMonthChoice, updateMonthInputs } from "./actions";
import { useMonthLocalFocus } from "./month-control-focus";
import { LocalChoiceScreen, primary, secondary } from "./month-choice-controls";
import { ControlFormFields } from "./currency-stepper";
import { controlMoney as money } from "@/domain/phase2/month-control-display";
import { MonthPreviewStatus } from "./month-preview-status";
import styles from "./month-control-center.module.css";
import material from "./month-material.module.css";

/** Reservation editing delegates every consequence to the existing month replay. */
export function MonthSavingEditor({ model, saving }: { model: MonthControlModel; saving: MonthControlModel["savings"][number] }) {
  const { openEntity } = useMonthLocalFocus();
  const router = useRouter();
  const [amount, setAmount] = useState(saving.amount), [remove, setRemove] = useState(false);
  const [previewRecord, setPreview] = useState<{ amount: string; digest: string; view: Awaited<ReturnType<typeof previewMonthChoice>> } | null>(null);
  const preview = previewRecord?.amount === amount && previewRecord.digest === model.baseDigest ? previewRecord.view : null;
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    const request = ++sequence.current; setPreview(null); setError(null);
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(amount) || Number(amount) === Number(saving.amount)) return;
    const timer = setTimeout(() => {
      previewMonthChoice(model.targetMonth, { operations: [{ kind: "SAVINGS", savingsId: saving.id, strategy: "TEST_SAVINGS", amount }] })
        .then(result => { if (request === sequence.current) { setPreview({ amount, digest: result.baseDigest, view: result }); if (result.baseDigest !== model.baseDigest) router.refresh(); } })
        .catch(() => { if (request === sequence.current) setError("Vérifiez le nouveau montant."); });
    }, 180);
    return () => { clearTimeout(timer); ++sequence.current; };
  }, [amount, saving.amount, saving.id, model.targetMonth, model.baseDigest, router]);
  const changed = Number(amount) !== Number(saving.amount);
  return <form action={updateMonthInputs} className={styles.choiceForm} data-save-ready={remove && saving.source === "MONTH_INPUT" || !!preview?.applicable} data-after-save="savings">
    <input type="hidden" name="expectedDigest" value={remove ? model.baseDigest : preview?.baseDigest ?? ""} />
    <ControlFormFields month={model.targetMonth} intent={remove ? "remove-declared-outflow" : "update-declared-savings"} values={{ outflowId: saving.id, outflowLabel: saving.label, outflowAmount: amount, outflowAdjustability: saving.adjustability, outflowDate: saving.dueDate ?? "" }} />
    <LocalChoiceScreen title={remove ? `Supprimer la cagnotte « ${saving.label} » ?` : "Ajuster cette cagnotte"} subtitle={saving.label} backLabel="Mes cagnottes" back={() => remove ? setRemove(false) : openEntity("savings")} footer={remove ? <><button type="button" className={secondary} onClick={() => setRemove(false)}>Annuler</button><button type="submit" className={styles.dangerAction}>Supprimer</button></> : changed ? <><button type="button" className={styles.textAction} onClick={() => setAmount(saving.amount)}>Annuler le test</button><button type="submit" className={primary} disabled={!preview?.applicable}>Enregistrer le nouveau montant</button></> : undefined}>
      {remove ? <p>Cette action retire sa réservation mensuelle. Vos dépenses prévues ne changent pas.</p> : <>
        <div className={styles.testAmount}><span>Montant actuellement mis de côté</span><strong>{money(saving.amount, true)}</strong><label>Nouveau montant (€)<input className={material.field} type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></label></div>
        <div className={styles.quickChoices}>{[20,50].filter(delta => Number(saving.amount) >= delta).map(delta => <button type="button" className={styles.smallChoice} key={delta} onClick={() => setAmount((Number(saving.amount)-delta).toFixed(2))}>−{delta} €</button>)}{Number(saving.amount) > 0 && <button type="button" className={styles.smallChoice} onClick={() => setAmount("0.00")}>Libérer tout</button>}</div>
        <div className={styles.pilotConsequence} aria-live="polite">{preview ? <><div><span>Montant mis de côté</span><strong>{money(saving.amount)} → {money(amount)}</strong></div><div><span>Disponible du mois</span><strong>{money(preview.before.central)} → {money(preview.after.central)}</strong></div><div><span>Dépenses prévues</span><strong>Inchangées</strong></div></> : <p>{error ?? (changed ? <MonthPreviewStatus active /> : "Votre réservation reste inchangée.")}</p>}</div>
        {saving.source === "MONTH_INPUT" && <button type="button" className={styles.dangerAction} onClick={() => setRemove(true)}>Supprimer cette cagnotte</button>}
      </>}
    </LocalChoiceScreen>
  </form>;
}
