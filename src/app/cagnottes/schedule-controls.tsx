"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { parseSavingsCents, savingsEuros, savingsMoney } from "@/domain/phase2/savings-goals";
import { spreadSavings, type SavingsScheduleRequest } from "@/domain/phase2/savings-schedule";
import { confirmSavingsSchedule, previewSavingsSchedule } from "./actions";
import styles from "./savings.module.css";

type Request = Parameters<typeof previewSavingsSchedule>[0];
type Preview = Extract<Awaited<ReturnType<typeof previewSavingsSchedule>>, { ok: true }>;
type MonthChoice = { value: string; label: string };
const labelMonth = (month: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${month}-01T12:00:00Z`));
const labelDate = (date: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${date}T12:00:00Z`));
const margin = (cents: number | null) => cents === null ? "Marge à confirmer" : savingsMoney(cents);

function useSchedule() {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<{ input: Request; result: Preview }>();
  const [message, setMessage] = useState("");
  const reset = () => { setDraft(undefined); setMessage(""); };
  function check(input: Request) {
    reset();
    start(async () => {
      try {
        const result = await previewSavingsSchedule(input);
        if (result.ok) setDraft({ input, result });
        else setMessage(result.message);
      } catch { setMessage("L’aperçu est indisponible pour le moment."); }
    });
  }
  function apply() {
    if (!draft || pending) return;
    start(async () => {
      try {
        const result = await confirmSavingsSchedule(draft.input, draft.result.stamp);
        setDraft(undefined);
        setMessage(result.ok ? "Planning enregistré." : result.message);
      } catch { setMessage("Impossible d’enregistrer le planning."); }
    });
  }
  return { draft, pending, message, check, apply, reset };
}

function ScheduleResult({ schedule }: { schedule: ReturnType<typeof useSchedule> }) {
  const preview = schedule.draft?.result;
  return <>
    {schedule.pending && <p role="status">Calcul du planning…</p>}
    {schedule.message && <p role="status">{schedule.message}</p>}
    {preview && <div className={styles.scheduleResult} aria-label="Aperçu du planning">
      {preview.note && <p>{preview.note}</p>}
      {preview.moves.length > 0 && <ul className={styles.scheduleMoves}>
        {preview.moves.map((move, index) => <li key={`${move.goalId}-${index}`}>
          <strong>{move.label} · {savingsMoney(move.cents)}</strong>
          <span>{labelMonth(move.from)} → {labelMonth(move.to)}{move.date && ` · à financer d’ici le ${labelDate(move.date)}`}</span>
        </li>)}
      </ul>}
      {preview.impact.length > 0 && <section aria-label="Effet sur la marge prévisionnelle" data-budget-reveal>
        <h3>Effet sur la marge prévisionnelle</h3>
        <ul className={styles.impactMonths}>{preview.impact.map(item => <li key={item.month}>
          <header><strong>{labelMonth(item.month)}</strong>
            <span>{item.delta < 0 ? "+" : item.delta > 0 ? "−" : ""}{savingsMoney(Math.abs(item.delta))} sur la marge</span></header>
          <dl><div><dt>Avant</dt><dd>{margin(item.before)}</dd></div><ArrowRight size={14} aria-hidden />
            <div><dt>Après</dt><dd className={item.after !== null && item.after < 0 ? styles.warning : undefined}>{margin(item.after)}</dd></div></dl>
          {item.limits.length > 0 && <small>{item.limits.join(" · ")}</small>}
        </li>)}</ul>
      </section>}
      {preview.remaining > 0 && <p className={styles.warning}>{savingsMoney(preview.remaining)} de déficit restent à couvrir. Les autres mois ont une marge insuffisante ou à confirmer.</p>}
      {preview.blocked.map(goal => <p key={goal.goalId} className={styles.warning}>
        Aucun report compatible trouvé pour <Link href={`?goal=${goal.goalId}#cagnotte-${goal.goalId}`}>{goal.label}</Link>
        {goal.date && ` avant le ${labelDate(goal.date)}`}.
      </p>)}
      {preview.gaps?.map(goal => <p key={goal.goalId} className={styles.warning}>
        {goal.label} · {savingsMoney(goal.cents)} restent à financer{goal.date && ` d’ici le ${labelDate(goal.date)}`}.
      </p>)}
      {!!preview.stamp && !!preview.impact.length && <button type="button" className={styles.primary} disabled={schedule.pending}
        onClick={schedule.apply}>Confirmer le planning</button>}
    </div>}
  </>;
}

export function SavingsFundingPlanner({ goalId, revision, months, selected, remaining, cutoff }: {
  goalId: string; revision: number; months: MonthChoice[]; selected?: string; remaining: number; cutoff: string | null;
}) {
  const [mode, setMode] = useState<"single" | "spread" | "custom">("single");
  const [month, setMonth] = useState(months.some(item => item.value === selected) ? selected! : months[0].value);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const schedule = useSchedule();
  const spread = mode === "spread" ? spreadSavings(remaining, months.filter(item => item.value >= month).map(item => item.value)) : [];
  function submit(event: FormEvent) {
    event.preventDefault();
    const deposits = mode === "custom" ? months.filter(item => (amounts[item.value] ?? "").trim().length > 0)
      .map(item => ({ month: item.value, cents: parseSavingsCents(amounts[item.value].trim()) ?? 0 })) : [];
    schedule.check({ kind: "plan", goalId, revision, mode, month, deposits });
  }
  return <div className={styles.planner}>
    <form className={styles.form} onSubmit={submit}>
      <label>Planifier {savingsMoney(remaining)}
        <select value={mode} disabled={schedule.pending} onChange={event => { setMode(event.target.value as typeof mode); schedule.reset(); }}>
          <option value="single">Tout sur un mois</option>
          <option value="spread" disabled={!cutoff}>Lisser jusqu’à la date de financement</option>
          <option value="custom">Choisir mois par mois</option>
        </select>
      </label>
      {!cutoff && <small>Renseigne une date d’achat ou une échéance pour lisser le montant.</small>}
      {mode !== "custom" ? <label>{mode === "spread" ? "Premier mois" : "Mois de financement"}
        <select value={month} disabled={schedule.pending} onChange={event => { setMonth(event.target.value); schedule.reset(); }}>
          {months.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select></label> : <div className={styles.scheduleMonths}>
        {months.map(item => <label key={item.value}>{item.label}
          <input inputMode="decimal" placeholder="0,00 €" value={amounts[item.value] ?? ""} disabled={schedule.pending}
            onChange={event => { const value = event.target.value; setAmounts(current => ({ ...current, [item.value]: value })); schedule.reset(); }} />
        </label>)}
      </div>}
      {!!spread.length && <p>{spread.length} mois · {savingsMoney(spread.at(-1)!.cents)}
        {spread[0].cents !== spread.at(-1)!.cents && ` à ${savingsMoney(spread[0].cents)}`} par mois</p>}
      <button className={styles.quiet} disabled={schedule.pending}>Voir l’effet sur la marge</button>
    </form>
    <ScheduleResult schedule={schedule} />
  </div>;
}

export function SavingsPartialMove({ goalId, revision, allocationId, months, cents }: {
  goalId: string; revision: number; allocationId: string; months: MonthChoice[]; cents: number;
}) {
  const [month, setMonth] = useState(months[0].value);
  const [amount, setAmount] = useState(savingsEuros(cents).replace(".", ","));
  const schedule = useSchedule();
  function submit(event: FormEvent) {
    event.preventDefault();
    const request: SavingsScheduleRequest = { kind: "move", goalId, revision, allocationId, month, cents: parseSavingsCents(amount.trim()) ?? 0 };
    schedule.check(request);
  }
  return <div className={styles.planner}>
    <form className={styles.form} onSubmit={submit}>
      <label>Reporter vers<select value={month} disabled={schedule.pending} onChange={event => { setMonth(event.target.value); schedule.reset(); }}>
        {months.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>Montant à reporter (€)<input inputMode="decimal" required value={amount} disabled={schedule.pending}
        onChange={event => { setAmount(event.target.value); schedule.reset(); }} /></label>
      <button className={styles.quiet} disabled={schedule.pending}>Voir l’effet du report</button>
    </form>
    <ScheduleResult schedule={schedule} />
  </div>;
}

export function SavingsReportSuggestions({ month }: { month: string }) {
  const schedule = useSchedule();
  return <div className={styles.planner} id="reports">
    <button type="button" className={styles.quiet} disabled={schedule.pending}
      onClick={() => schedule.check({ kind: "suggest", month })}>Proposer des reports</button>
    <ScheduleResult schedule={schedule} />
  </div>;
}
