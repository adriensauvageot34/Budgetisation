"use client";
import { useState, type ReactNode } from "react";
import { relativeAmountDraft, relativePercentDraft } from "@/domain/phase2/month-choice-ui-draft";
import { controlMoney as money } from "@/domain/phase2/month-control-display";
import material from "./month-material.module.css";
import styles from "./month-control-center.module.css";

export const primary = `${material.clayPrimary} ${styles.primaryAction}`;
export const secondary = `${material.clayButton} ${styles.secondaryAction}`;
export function LocalChoiceScreen({ title, subtitle, back, backLabel = "Retour au Centre", children, footer, step, total, kind = "intention" }: {
  title: string; subtitle?: ReactNode; back: () => void; backLabel?: string; children: ReactNode; footer?: ReactNode; step?: number; total?: number; kind?: string;
}) {
  return <section className={styles.choiceScreen} data-choice-view={kind}>
    <header className={styles.localHeader}><button type="button" className={styles.localBack} onClick={back}>← {backLabel}</button>
      <div><h2 className={styles.localTitle}>{title}</h2>{subtitle && <p className={styles.localSubtitle}>{subtitle}</p>}</div>
      {step !== undefined && <span className={styles.wizardProgress}>Étape {step} sur {total}</span>}
    </header>
    <div className={styles.choiceBody}>{children}</div>
    {footer && <footer className={styles.actionFooter}>{footer}</footer>}
  </section>;
}
export function ChoiceTile({ title, children, onClick, active, disabled }: { title: string; children?: ReactNode; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return <button type="button" className={styles.choiceTile} onClick={onClick} aria-pressed={active} disabled={disabled}><strong>{title}</strong>{children && <span>{children}</span>}</button>;
}
export function ChoicePages({ count, page, setPage, size = 6 }: { count: number; page: number; setPage: (page: number) => void; size?: number }) {
  const pages = Math.ceil(count / size);
  return pages > 1 ? <nav className={styles.pageNav} aria-label="Pages de choix"><button type="button" className={secondary} disabled={!page} onClick={() => setPage(page - 1)}>Précédents</button><span>Page {page + 1}/{pages}</span><button type="button" className={secondary} disabled={page + 1 === pages} onClick={() => setPage(page + 1)}>Autres postes →</button></nav> : null;
}
export function PercentStepper({ valuePercent, onChange, min = -100, max = 500, label, shortcuts = [-10, -20, -30, 0] }: {
  valuePercent: number; onChange: (value: number) => void; min?: number; max?: number; label: string; shortcuts?: readonly number[];
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  return <div className={styles.percentControl} aria-label={label}><div className={styles.percentStepper}>
    <button type="button" className={secondary} aria-label={`Diminuer ${label} de 5 %`} disabled={valuePercent <= min} onClick={() => onChange(clamp(valuePercent - 5))}>−5 %</button>
    <output>{valuePercent > 0 ? "+" : ""}{new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(valuePercent)} %</output>
    <button type="button" className={secondary} aria-label={`Augmenter ${label} de 5 %`} disabled={valuePercent >= max} onClick={() => onChange(clamp(valuePercent + 5))}>+5 %</button>
    </div>{shortcuts.length > 0 && <div className={styles.quickChoices}>{shortcuts.filter(n => n >= min && n <= max).map(n => <button key={n} type="button" className={styles.smallChoice} aria-pressed={valuePercent === n} onClick={() => onChange(n)}>{n === 0 ? "Référence" : `${n > 0 ? "+" : ""}${n} %`}</button>)}</div>}</div>;
}
export function RelativeAmountControl({ reference, initial, name, label, onChange }: { reference: string; initial: string; name: string; label: string; onChange?: (amount: string) => void }) {
  const [percent, setPercent] = useState(relativePercentDraft(reference, initial)), [amount, setAmount] = useState(initial), [precise, setPrecise] = useState(false);
  const change = (next: string) => { setAmount(next); onChange?.(next); };
  return <div className={styles.centerInteraction}>
    {precise ? <label className={styles.exactLabel}>Votre montant (€)<input autoFocus className={material.field} type="number" step="0.01" min="0" required value={amount} onChange={event => change(event.target.value)} /></label>
      : <PercentStepper valuePercent={percent} label={label} onChange={next => { setPercent(next); change(relativeAmountDraft(reference, next)); }} />}
    <input type="hidden" name={name} value={amount} /><div className={styles.draftAmount}><span>{label}</span><strong>{money(amount, precise)}</strong></div>
    <button type="button" className={styles.textAction} onClick={() => { if (precise) setPercent(relativePercentDraft(reference, amount)); setPrecise(!precise); }}>{precise ? "Choisir en pourcentage" : "Saisir un montant précis"}</button>
  </div>;
}
export function TargetGauge({ forecast, realized = "0", target }: { forecast: string; realized?: string; target: string }) {
  const scale = Math.max(Number(forecast), Number(realized), Number(target), 1);
  return <div className={styles.gauge} role="img" aria-label={`Réalisé ${money(realized, true)}, projection ${money(forecast)}, repère ${money(target, true)}`}>
    <span className={styles.projectedGauge} style={{ width: `${Number(forecast) / scale * 100}%` }} /><span className={styles.realizedGauge} style={{ width: `${Number(realized) / scale * 100}%` }} /><span className={styles.targetMarker} style={{ left: `${Math.min(98, Number(target) / scale * 100)}%` }} />
  </div>;
}
