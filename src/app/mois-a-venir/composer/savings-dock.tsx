"use client";

import Link from "next/link";
import { ArrowUpRight, PiggyBank, Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { parseSavingsCents, savingsEuros, savingsLivretUsed, savingsMoney, savingsProjects, savingsPurchaseTotals, savingsTravelTopics,
  type SavingsPurchaseItem } from "@/domain/phase2/savings-goals";
import type { RealizedCard, RealizedPayment } from "@/server/phase2/planner/realized-month";
import { loadSavingsChoices, saveSavingsPurchase } from "./savings-dock-actions";
import styles from "./savings-dock.module.css";

type Workspace = NonNullable<Awaited<ReturnType<typeof loadSavingsChoices>>>;
type Choice = Workspace["choices"][number];
type DraftItem = Omit<SavingsPurchaseItem, "grossCents" | "refundedCents" | "livretCents" | "recipient"> & {
  recipient: string; gross: string; refunded: string; livret: string;
};
const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  .replace(/[^a-z0-9]+/gu, " ").trim();
const paymentAmount = (payment: RealizedPayment) => parseSavingsCents(payment.amount.replace(/^-/, "")) ?? 0;
const inputAmount = (cents: number) => cents ? savingsEuros(cents).replace(".", ",") : "";

export function savingsPayments(card: RealizedCard | undefined, through?: string) {
  if (!card || card.pilotStatus && card.pilotStatus !== "confirmed") return [];
  return card.payments.filter(payment => payment.flow === "expense" && payment.amount.startsWith("-")
    && paymentAmount(payment) > 0 && (!through || payment.date <= through));
}

function rank(choice: Choice, payment: RealizedPayment, cardLabel: string, item: DraftItem) {
  const source = normalize([item.article, payment.label, payment.category, payment.preciseType, cardLabel].filter(Boolean).join(" "));
  const tokens = new Set(source.split(" "));
  const label = normalize(choice.label);
  const recipient = normalize(item.recipient);
  let score = choice.id === item.goalId ? 1000 : 0;
  if (recipient && ` ${label} `.includes(` ${recipient} `)) score += 32;
  if (choice.topic === "documents" && /\b(passeport|visa|formalites|timbre)\b/u.test(source)) score += 36;
  if (choice.topic === "flights" && /\b(avion|vol|billet|airline|easyjet|ryanair|transavia)\b/u.test(source)) score += 36;
  if (choice.topic === "bags" && /\b(sac|valise|bagage)\b/u.test(source)) score += 28;
  if (choice.topic === "equipment" && /\b(materiel|equipement)\b/u.test(source)) score += 24;
  if (choice.project === "christmas" && (tokens.has("noel") || payment.date.slice(5, 7) === "12"
    && /\b(amazon|cadeau|cadeaux|coffret|jouet)\b/u.test(source))) score += 28;
  if (choice.project === "birthday" && tokens.has("anniversaire")) score += 24;
  if (choice.project === "travel" && tokens.has("voyage")) score += 12;
  if (choice.season === Number(payment.date.slice(0, 4))) score += 16;
  if (choice.deadline) {
    const days = (Date.parse(choice.deadline) - Date.parse(payment.date)) / 86_400_000;
    if (days >= 0 && days <= 30) score += Math.ceil((31 - days) / 4);
  }
  return score + 3 * [...new Set(label.split(" "))].filter(word => word.length > 3 && tokens.has(word)).length;
}

export function savingsGoalHref(id: string) {
  return `/cagnottes?goal=${id}#cagnotte-${id}`;
}

export function SavingsDock({ cardLabel, payments, close, onSaved, goalId }: {
  cardLabel: string; payments: readonly RealizedPayment[]; close: () => void; onSaved?: () => void; goalId?: string;
}) {
  const [paymentId, setPaymentId] = useState(payments.length === 1 ? payments[0].id : "");
  const payment = payments.find(item => item.id === paymentId);
  return <section className={styles.dock} aria-label="Ventilation de l’achat">
    <div className={styles.header}>
      <h3><PiggyBank size={17} aria-hidden /> Ventiler l’achat</h3>
      <button className={styles.close} type="button" aria-label="Fermer la ventilation" onClick={close}><X size={17} aria-hidden /></button>
    </div>
    {payments.length > 1 && <label className={styles.field}>Paiement
      <select autoFocus value={paymentId} onChange={event => setPaymentId(event.target.value)}>
        <option value="">Choisir un paiement</option>
        {payments.map(item => <option key={item.id} value={item.id}>{item.label} · {savingsMoney(paymentAmount(item))}</option>)}
      </select>
    </label>}
    {payment && <PurchaseItems key={payment.id} payment={payment} cardLabel={cardLabel} onSaved={onSaved} goalId={goalId} />}
  </section>;
}

function PurchaseItems({ payment, cardLabel, onSaved, goalId }: { payment: RealizedPayment; cardLabel: string; onSaved?: () => void; goalId?: string }) {
  const cents = paymentAmount(payment);
  const [workspace, setWorkspace] = useState<Workspace | null>();
  const [rows, setRows] = useState<DraftItem[]>([]);
  const [active, setActive] = useState<string>();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [stale, setStale] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const saving = useRef(false);
  const recipientsId = useId();
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    void loadSavingsChoices(payment.id).then(value => {
      if (!mounted) return;
      setWorkspace(value);
      if (!value) return;
      if (value.items.length) {
        setRows(value.items.map(item => ({ ...item, recipient: item.recipient ?? "", gross: inputAmount(item.grossCents),
          refunded: inputAmount(item.refundedCents), livret: inputAmount(item.livretCents ?? 0) })));
        setActive(undefined);
      } else {
        const id = crypto.randomUUID();
        const suggested = value.choices.find(choice => choice.id === goalId && !choice.abandoned && !choice.complete);
        setRows([{ id, article: payment.label.slice(0, 120), recipient: (suggested?.recipient ?? payment.recipient)?.slice(0, 80) ?? "",
          goalId: suggested?.id ?? null, gross: inputAmount(cents), refunded: "", livret: "" }]);
        setActive(suggested ? undefined : id);
      }
    }, () => { if (mounted) setWorkspace(null); });
    return () => { mounted = false; };
  }, [payment.id, payment.label, payment.recipient, cents, attempt, goalId]);

  const activeRow = rows.find(row => row.id === active);
  const parsed = rows.map(row => ({ id: row.id, goalId: row.goalId, article: row.article.trim(), recipient: row.recipient.trim() || null,
    grossCents: parseSavingsCents(row.gross.trim()) ?? 0, refundedCents: parseSavingsCents(row.refunded.trim()) ?? 0,
    livretCents: parseSavingsCents(row.livret.trim()) ?? 0 }));
  const totals = savingsPurchaseTotals(parsed, cents);
  const invalid = parsed.some((item, index) => !item.article || !item.grossCents
    || Boolean(rows[index].refunded.trim()) && !/^(?:0(?:[,.]0{1,2})?)$/u.test(rows[index].refunded.trim()) && !item.refundedCents
    || Boolean(rows[index].livret.trim()) && !/^(?:0(?:[,.]0{1,2})?)$/u.test(rows[index].livret.trim()) && !item.livretCents
    || item.refundedCents > item.grossCents || item.livretCents > item.grossCents);
  const terms = normalize(query).split(" ").filter(Boolean);
  const ranked = activeRow && workspace ? workspace.choices
    .filter(choice => (!choice.abandoned || choice.id === activeRow.goalId)
      && (!choice.complete || choice.id === activeRow.goalId || terms.length > 0)
      && terms.every(term => normalize([choice.label, savingsProjects[choice.project],
        choice.topic && savingsTravelTopics[choice.topic], choice.season, choice.recipient].filter(Boolean).join(" ")).includes(term)))
    .map(choice => ({ choice, score: rank(choice, payment, cardLabel, activeRow) + (choice.id === goalId ? 500 : 0) }))
    .sort((a, b) => b.score - a.score || (a.choice.deadline ?? "9999").localeCompare(b.choice.deadline ?? "9999")
      || a.choice.label.localeCompare(b.choice.label, "fr")) : [];
  const visible = terms.length ? ranked : ranked.slice(0, 8);

  const update = (id: string, change: Partial<DraftItem>) => {
    setRows(current => current.map(row => row.id === id ? { ...row, ...change } : row));
    setMessage("");
  };
  const selectGoal = (id: string) => {
    setQuery("");
    setActive(active === id ? undefined : id);
    if (active !== id) requestAnimationFrame(() => search.current?.focus({ preventScroll: true }));
  };
  const reload = () => { setStale(false); setMessage(""); setWorkspace(undefined); setAttempt(value => value + 1); };

  const save = async () => {
    if (!workspace || saving.current || invalid || totals.remaining < 0 || stale) return;
    saving.current = true;
    setBusy(true);
    setMessage("");
    try {
      const result = await saveSavingsPurchase({ operationId: payment.id, previous: workspace.items, items: parsed });
      if (result === "saved") {
        setWorkspace({ ...workspace, items: parsed, choices: workspace.choices.map(choice => ({
          ...choice, livretAvailable: choice.livretAvailable
            + workspace.items.filter(row => row.goalId === choice.id).reduce((sum, row) => sum + savingsLivretUsed(row), 0)
            - parsed.filter(row => row.goalId === choice.id).reduce((sum, row) => sum + savingsLivretUsed(row), 0),
        })) });
        setMessage("Ventilation enregistrée.");
        onSaved?.();
      } else if (result === "stale") {
        setStale(true);
        setMessage("Cette ventilation a changé depuis son ouverture.");
      } else if (result === "livret") {
        setMessage("La part payée avec le livret dépasse le solde disponible de la cagnotte.");
      } else if (result === "amount" || result === "invalid") {
        setMessage("Vérifie les prix des articles et les montants remboursés.");
      } else setMessage("Impossible d’enregistrer la ventilation. Réessaie.");
    } catch {
      setMessage("Impossible d’enregistrer la ventilation. Réessaie.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  if (workspace === undefined) return <p role="status">Chargement de la ventilation…</p>;
  if (workspace === null) return <p role="alert">Ventilation indisponible. <button type="button" onClick={reload}>Réessayer</button></p>;
  return <form className={styles.form} onSubmit={event => { event.preventDefault(); void save(); }}>
    <dl className={styles.totals}>
      <div><dt>Débit</dt><dd>{savingsMoney(cents)}</dd></div>
      <div><dt>Réparti</dt><dd>{savingsMoney(totals.described)}</dd></div>
      <div data-over={totals.remaining < 0}><dt>{totals.remaining < 0 ? "Dépassement" : "Reste à répartir"}</dt><dd>{savingsMoney(Math.abs(totals.remaining))}</dd></div>
      <div><dt>En cagnottes</dt><dd>{savingsMoney(totals.linked)}</dd></div>
      {totals.outside > 0 && <div><dt>Hors cagnotte</dt><dd>{savingsMoney(totals.outside)}</dd></div>}
      {totals.refunded > 0 && <div><dt>Remboursé</dt><dd>{savingsMoney(totals.refunded)}</dd></div>}
    </dl>
    <datalist id={recipientsId}>{workspace.recipients.map(name => <option key={name} value={name} />)}</datalist>
    <ol className={styles.lines}>
      {rows.map((row, index) => {
        const choice = workspace.choices.find(goal => goal.id === row.goalId);
        return <li key={row.id} className={styles.line} aria-label={`Article ${index + 1}`}>
          <div className={styles.fields}>
            <label>Article<input required maxLength={120} value={row.article} disabled={busy}
              onChange={event => update(row.id, { article: event.target.value })} placeholder="Cadeau, billet…" /></label>
            <label>Destinataire<input maxLength={80} list={recipientsId} value={row.recipient} disabled={busy}
              onChange={event => update(row.id, { recipient: event.target.value })} placeholder="Facultatif" /></label>
            <label>Prix (€)<input required inputMode="decimal" value={row.gross} disabled={busy}
              onChange={event => update(row.id, { gross: event.target.value })} placeholder="0,00" /></label>
            <button type="button" className={styles.close} disabled={busy} title="Retirer cette ligne" aria-label={`Retirer l’article ${index + 1}`}
              onClick={() => { setRows(current => current.filter(item => item.id !== row.id)); setMessage(""); }}><X size={16} aria-hidden /></button>
          </div>
          <div className={styles.lineActions}>
            <button type="button" disabled={busy} aria-expanded={active === row.id} onClick={() => selectGoal(row.id)}>
              {choice ? choice.label : "Hors cagnotte · Choisir"}
            </button>
            {choice && <Link href={savingsGoalHref(choice.id)} prefetch={false}>
              Ouvrir la cagnotte <ArrowUpRight size={13} aria-hidden />
            </Link>}
            {choice && <details className={styles.refund} open={!!row.livret || undefined}>
              <summary>{parsed[index].livretCents ? `${savingsMoney(savingsLivretUsed(parsed[index]))} du livret` : "Payé avec le livret"}</summary>
              <label className={styles.field}>Part du livret (€)
                <input inputMode="decimal" value={row.livret} disabled={busy} placeholder="0,00"
                  onChange={event => update(row.id, { livret: event.target.value })} />
              </label>
              <small>{savingsMoney(choice.livretAvailable)} encore disponibles sur cet objectif avant cette modification.</small>
            </details>}
            <details className={styles.refund}>
              <summary>{row.refunded && parsed[index].refundedCents > 0 ? `${savingsMoney(parsed[index].refundedCents)} remboursés` : "Remboursement"}</summary>
              <label className={styles.field}>Total reçu (€)
                <input inputMode="decimal" value={row.refunded} disabled={busy} placeholder="0,00"
                  onChange={event => update(row.id, { refunded: event.target.value })} />
              </label>
              <button type="button" disabled={busy || !parsed[index].grossCents} onClick={() => update(row.id, { refunded: row.gross })}>
                Article intégralement remboursé
              </button>
            </details>
          </div>
          {active === row.id && <div className={styles.picker}>
            <div className={styles.filters}>
              <input ref={search} type="search" aria-label="Rechercher une cagnotte" placeholder="Rechercher une cagnotte"
                value={query} onChange={event => setQuery(event.target.value)} />
              <button type="button" disabled={busy} onClick={() => { update(row.id, { goalId: null, livret: "" }); setActive(undefined); }}>
                Laisser hors cagnotte
              </button>
            </div>
            {!!visible.length && <ul className={styles.goals} aria-label={terms.length ? "Résultats de recherche" : "Cagnottes proposées"}>
              {visible.map(({ choice: option }) => <li key={option.id}>
                <button type="button" className={styles.goal} data-project={option.project} disabled={busy} aria-pressed={row.goalId === option.id}
                  onClick={() => { update(row.id, { goalId: option.id, recipient: row.recipient || option.recipient || "" }); setActive(undefined); }}>
                  <small>{savingsProjects[option.project]}{option.season && ` · ${option.season}`}{option.topic && ` · ${savingsTravelTopics[option.topic]}`}</small>
                  <strong>{option.label}</strong>
                </button>
              </li>)}
            </ul>}
            {!visible.length && <p>Aucune cagnotte à proposer. <Link href="/cagnottes">Voir les cagnottes</Link></p>}
          </div>}
        </li>;
      })}
    </ol>
    <div className={styles.formActions}>
      <button type="button" disabled={busy || rows.length >= 50} onClick={() => {
        setRows(current => [...current, { id: crypto.randomUUID(), article: "", recipient: "", goalId: null,
          gross: inputAmount(Math.max(0, totals.remaining)), refunded: "", livret: "" }]);
        setMessage("");
      }}><Plus size={15} aria-hidden /> Ajouter un article</button>
      <button type="submit" className={styles.primary} disabled={busy || invalid || totals.remaining < 0 || stale}>
        {busy ? "Enregistrement…" : "Enregistrer la ventilation"}
      </button>
    </div>
    {invalid && <p className={styles.notice}>Vérifie le prix, le remboursement et la part du livret de chaque article.</p>}
    {message && <p role="status">{message} {stale && <button type="button" onClick={reload}>Recharger la ventilation</button>}</p>}
  </form>;
}
