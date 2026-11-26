"use client";

import Link from "next/link";
import { PiggyBank, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { maxSavingsCents, parseSavingsCents, savingsEuros, savingsMoney, savingsProjects, savingsTravelTopics } from "@/domain/phase2/savings-goals";
import type { RealizedCard, RealizedPayment } from "@/server/phase2/planner/realized-month";
import { loadSavingsChoices, saveSavingsChoice } from "./savings-dock-actions";
import styles from "./savings-dock.module.css";

type Choice = NonNullable<Awaited<ReturnType<typeof loadSavingsChoices>>>[number];
const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/gu, " ").trim();
const paymentAmount = (payment: RealizedPayment) => parseSavingsCents(payment.amount.replace(/^-/, "")) ?? 0;

export function savingsPayments(card: RealizedCard | undefined, through?: string) {
  if (!card || card.pilotStatus && card.pilotStatus !== "confirmed") return [];
  return card.payments.filter(payment => payment.flow === "expense" && payment.amount.startsWith("-")
    && paymentAmount(payment) > 0 && (!through || payment.date <= through));
}

function rank(choice: Choice, payment: RealizedPayment, cardLabel: string) {
  const source = normalize([payment.label, payment.category, payment.preciseType, payment.recipient, cardLabel].filter(Boolean).join(" "));
  const tokens = new Set(source.split(" "));
  const label = normalize(choice.label);
  const recipient = normalize(payment.recipient ?? "");
  let score = choice.currentCents > 0 ? 1000 : 0;
  if (recipient && ` ${label} `.includes(` ${recipient} `)) score += 32;
  if (choice.topic === "documents" && /\b(passeport|visa|formalites|timbre)\b/u.test(source)) score += 36;
  if (choice.topic === "flights" && /\b(avion|vol|billet|airline|easyjet|ryanair|transavia)\b/u.test(source)) score += 36;
  if (choice.topic === "bags" && /\b(sac|valise|bagage)\b/u.test(source)) score += 28;
  if (choice.topic === "equipment" && /\b(materiel|equipement)\b/u.test(source)) score += 24;
  if (choice.project === "christmas" && (/\bnoel\b/u.test(source) || /-12-/u.test(payment.date) && tokens.has("cadeau"))) score += 24;
  if (choice.project === "birthday" && tokens.has("anniversaire")) score += 24;
  if (choice.project === "travel" && tokens.has("voyage")) score += 12;
  const matchingWords = [...new Set(label.split(" "))].filter(word => word.length > 3 && tokens.has(word));
  return score + 3 * matchingWords.length;
}

export function SavingsDock({ cardLabel, payments, close }: {
  cardLabel: string; payments: readonly RealizedPayment[]; close: () => void;
}) {
  const [paymentId, setPaymentId] = useState(payments.length === 1 ? payments[0].id : "");
  const payment = payments.find(item => item.id === paymentId);
  return <section className={styles.dock} aria-label="Affecter à une cagnotte">
    <div className={styles.header}>
      <h3><PiggyBank size={17} aria-hidden /> Affecter à une cagnotte</h3>
      <button className={styles.close} type="button" aria-label="Fermer le menu des cagnottes" onClick={close}><X size={17} aria-hidden /></button>
    </div>
    {payments.length > 1 && <label className={styles.field}>Paiement
      <select autoFocus value={paymentId} onChange={event => setPaymentId(event.target.value)}>
        <option value="">Choisir un paiement</option>
        {payments.map(item => <option key={item.id} value={item.id}>{item.label} · {savingsMoney(paymentAmount(item))}</option>)}
      </select>
    </label>}
    {payment && <SavingsChoices key={payment.id} payment={payment} cardLabel={cardLabel} focusSearch={payments.length === 1} />}
  </section>;
}

function SavingsChoices({ payment, cardLabel, focusSearch }: { payment: RealizedPayment; cardLabel: string; focusSearch: boolean }) {
  const [choices, setChoices] = useState<Choice[] | null>();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Choice>();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState("");
  const [attempt, setAttempt] = useState(0);
  const saving = useRef(false);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void loadSavingsChoices(payment.id).then(value => { if (active) setChoices(value); }, () => { if (active) setChoices(null); });
    return () => { active = false; };
  }, [payment.id, attempt]);
  useEffect(() => { if (focusSearch) search.current?.focus({ preventScroll: true }); }, [focusSearch]);

  const remaining = paymentAmount(payment) - (choices ?? []).reduce((sum, choice) => sum + choice.currentCents, 0);
  const terms = normalize(query).split(" ").filter(Boolean);
  const filtered = [...(choices ?? [])]
    .filter(choice => {
      const fields = normalize([choice.label, savingsProjects[choice.project], choice.topic && savingsTravelTopics[choice.topic]].filter(Boolean).join(" "));
      return terms.every(term => fields.includes(term));
    })
    .map(choice => ({ choice, score: rank(choice, payment, cardLabel) }))
    .sort((a, b) => b.score - a.score || (a.choice.deadline ?? "9999").localeCompare(b.choice.deadline ?? "9999")
      || a.choice.label.localeCompare(b.choice.label, "fr"));
  const visible = terms.length > 0 ? filtered : filtered.slice(0, 8);

  const reload = () => { setChoices(undefined); setAttempt(value => value + 1); };
  const save = async (remove = false) => {
    if (!selected || saving.current) return;
    saving.current = true;
    setBusy(true);
    setResponse("");
    try {
      const result = await saveSavingsChoice({ operationId: payment.id, goalId: selected.id,
        amount, previous: selected.currentCents, remove });
      if (result === "saved") {
        setResponse(remove ? "Affectation retirée." : `${selected.label} · ${savingsMoney(parseSavingsCents(amount) ?? 0)} affectés.`);
        setSelected(undefined);
        reload();
        search.current?.focus();
      } else if (result === "stale") {
        setSelected(undefined);
        setResponse("Cette affectation a changé. Choisis de nouveau la cagnotte.");
        reload();
      } else {
        setResponse(result === "amount" ? "Le montant dépasse la part disponible de ce paiement." : "Impossible d’enregistrer. Réessaie.");
      }
    } catch {
      setResponse("Impossible d’enregistrer. Réessaie.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return <>
    <div className={styles.filters}>
      <input ref={search} type="search" aria-label="Rechercher une cagnotte" placeholder="Rechercher une cagnotte"
        value={query} onChange={event => setQuery(event.target.value)} />
      {choices && <span>{savingsMoney(Math.max(0, remaining))} disponibles sur ce paiement</span>}
    </div>
    {choices === undefined && <p role="status">Chargement des cagnottes…</p>}
    {choices === null && <p role="alert">Cagnottes indisponibles. <button type="button" onClick={reload}>Réessayer</button></p>}
    {choices && !choices.length && <p>Aucune cagnotte ouverte. <Link href="/cagnottes">Voir les cagnottes</Link></p>}
    {choices && choices.length > 0 && !visible.length && <p>Aucun résultat pour cette recherche.</p>}
    {!!visible.length && <ul className={styles.goals} aria-label={terms.length ? "Résultats de la recherche" : "Cagnottes proposées"}>
      {visible.map(({ choice }) => <li key={choice.id}><button type="button" className={styles.goal} data-project={choice.project}
        disabled={busy || !choice.currentCents && remaining <= 0} aria-pressed={selected?.id === choice.id} onClick={() => {
          setSelected(choice);
          setAmount(savingsEuros(choice.currentCents || Math.min(remaining, maxSavingsCents)).replace(".", ","));
          setResponse("");
        }}>
        <small>{savingsProjects[choice.project]}{choice.topic && ` · ${savingsTravelTopics[choice.topic]}`}</small>
        <strong>{choice.label}</strong>
        <span>{choice.currentCents ? `${savingsMoney(choice.currentCents)} liés à ce paiement`
          : choice.targetCents ? `${savingsMoney(choice.fundedCents)} financés sur ${savingsMoney(choice.targetCents)}` : "Objectif à chiffrer"}</span>
      </button></li>)}
    </ul>}
    {selected && <form className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className={styles.field}>Montant en euros
        <input name="amount" inputMode="decimal" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} />
      </label>
      <button className={styles.primary} type="submit" disabled={busy || (parseSavingsCents(amount) ?? 0) <= 0
        || (parseSavingsCents(amount) ?? 0) > remaining + selected.currentCents}>{busy ? "En cours…" : "Enregistrer l’affectation"}</button>
      {!!selected.currentCents && <button type="button" disabled={busy} onClick={() => void save(true)}>Retirer l’affectation</button>}
    </form>}
    {response && <p role="status">{response}</p>}
  </>;
}
