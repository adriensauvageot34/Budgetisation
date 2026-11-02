import { LockKeyhole } from "lucide-react";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel, ComposerMonthReadResource, ComposerOperation } from "@/domain/phase2/planner/composer-ui-contract";
import { CoursesMonthTarget } from "./courses-month-target";
import type { PlannerJsonObject } from "@/domain/phase2/planner/json";
import { controlValuePresentation, controlValueSummary } from "./control-value-presentation";
import { knowledgeLabel, money, monthLabel, quantityLabel } from "./display";
import styles from "./composer.module.css";

const dateLabel = (value: string | null) => value && /^\d{4}-\d{2}-\d{2}/u.test(value)
  ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : "Non publiée";
const sourceLabel = (owner: string) => owner === "MonthForecast" ? "Prévision mensuelle"
  : owner === "phase2_month_inputs" ? "Informations saisies pour ce mois"
    : /food/iu.test(owner) ? "Historique alimentaire" : /economic/iu.test(owner) ? "Historique économique" : "Source publiée";

/** Identity-based links only. Opening this reading never invokes an editor or transport. */
export function monthReadTargets(model: ComposerUiModel): ReadonlySet<string> {
  const domains = model.monthRead?.targetMonth === model.board.targetMonth ? model.monthRead.controlDomains : {};
  return new Set([...model.board.baselineControls.filter(card => ["groceries", "tobacco-vape"].includes(domains[card.targetRef])),
    ...model.board.savings, ...model.board.discretionaryControls.filter(card => controlValuePresentation(card).kind !== "UNKNOWN")].map(card => card.targetRef));
}

type Row = Readonly<{ id: string; label: string; value: string; meaning: string; caption: string; knowledge: string;
  date: string; source: string; origin: "HISTORICAL" | "PUBLISHED" | "SCENARIO" | "UNKNOWN";
  notice?: string; referencePeriod?: string; referenceValue?: string; protected?: boolean; targetRef?: string; targetNote?: string }>;

/** Display an immutable owner reference while the local Draft/Preview is pending.
 * Card.value.amount/count can be optimistic; knowledge and referenceValue are not. */
export function monthControlReading(model: ComposerUiModel, card: ComposerCardView, stale: boolean) {
  const published = controlValuePresentation(card);
  const dimensions = model.cardKnowledge[`control:${card.targetRef}`]?.dimensions ?? [];
  const history = dimensions.find(dimension => ["MONTH_AMOUNT", "OCCURRENCE_COUNT"].includes(dimension.key));
  const historyKnown = history?.value !== null && history?.value !== undefined && history.evidenceState !== "UNKNOWN";
  const unitPrice = dimensions.find(dimension => dimension.key === "UNIT_PRICE");
  const historyValue = !historyKnown ? null : history.unit === "EUR_PER_MONTH" ? money(history.value)
    : `${quantityLabel(history.value)} occurrence(s) · ${unitPrice?.value === null || unitPrice?.value === undefined ? "prix de référence à préciser" : `prix de référence : ${money(unitPrice.value)}`}`;
  const rawReference = card.value.referenceValue;
  const reference = rawReference && typeof rawReference === "object" && !Array.isArray(rawReference) ? rawReference as PlannerJsonObject : null;
  // A SUGGESTION_ONLY zero is not an adopted envelope or a known reservation.
  const fallback = !history && card.value.inclusion !== "SUGGESTION_ONLY" && card.knowledge !== "UNKNOWN" && typeof reference?.amount === "string"
    ? money(reference.amount) : null;
  const knownReference = historyValue ?? fallback;
  const historicalOnly = historyKnown && published.kind !== "DECISION";
  const origin: Row["origin"] = stale ? historyValue !== null ? "HISTORICAL" : fallback !== null ? "PUBLISHED" : "UNKNOWN"
    : published.kind === "DECISION" ? "SCENARIO" : published.kind === "UNKNOWN" ? "UNKNOWN" : historyKnown ? "HISTORICAL" : "PUBLISHED";
  return { value: stale ? knownReference ?? (published.kind === "DECISION" ? "Projection à recalculer" : "À préciser") : controlValueSummary(card),
    caption: stale ? knownReference !== null ? "Dernière référence connue" : "Valeur à actualiser"
      : historicalOnly ? "Référence historique · non choisie" : published.shortLabel,
    meaning: stale && historyKnown ? "Référence historique · distincte du choix et de sa projection"
      : historicalOnly ? "Référence historique · non choisie" : published.label,
    origin, notice: stale ? knownReference !== null ? "Dernière valeur connue · actualisation en attente. Aucune projection actualisée n’est affirmée."
      : "Projection à recalculer ; aucune référence connue ne permet de remplacer ce montant." : undefined,
    knowledge: knowledgeLabel(history?.evidenceState ?? card.knowledge),
    referencePeriod: history?.coverageFrom && history.coverageTo ? `${monthLabel(history.coverageFrom)} → ${monthLabel(history.coverageTo)}` : "Période de référence non publiée",
    referenceValue: history?.unit === "EUR_PER_MONTH" ? money(history.value) : fallback ?? undefined };
}

export function ComposerMonthRead({ model, stale, focused, focus, busy = false, decide }: {
  model: ComposerUiModel; stale: boolean; focused: string | null; focus: (ref: string) => void;
  busy?: boolean; decide?: (operation: ComposerOperation) => boolean;
}) {
  const month = model.board.targetMonth;
  const facts = model.monthRead?.targetMonth === month ? model.monthRead : undefined;
  // The published presentation explicitly excludes these reservations from the Board.
  const isOnBoard = (ref: string) => !(model.presentation.availableReservationRefs ?? []).includes(ref);
  const sources = (refs: readonly string[]) => {
    const labels = refs.flatMap(ref => facts?.sourceOwners[ref] ? [sourceLabel(facts.sourceOwners[ref])] : []);
    return [...new Set(labels)].join(" · ") || "Source non détaillée";
  };
  const factRow = (fact: Omit<ComposerMonthReadResource, "role">, resource: boolean, stock = false): Row => {
    const funding = fact.factKey === "benefit:swile" ? "Swile" : fact.factKey === "benefit:edenred" ? "Edenred" : null;
    return { id: fact.factKey, label: stock ? "Solde bancaire déclaré" : funding ? `Financement ${funding}` : fact.label,
      value: money(fact.value.central), knowledge: knowledgeLabel(fact.knowledge), source: sources(fact.sourceRefs),
      origin: "PUBLISHED", caption: fact.value.central === null ? "Montant à préciser" : stale ? "Dernière valeur connue" : stock ? "Stock déclaré" : funding ? "Financement prévu" : fact.knowledge === "DECLARED" ? "Montant déclaré" : "Montant prévu",
      notice: stale ? "Dernière lecture publiée · actualisation en attente." : undefined,
      meaning: stock ? "Stock déclaré · pas un revenu" : funding ? "Financement prévu · pas un revenu bancaire"
        : resource ? "Ressource prévue · encaissement non attesté" : "Charge prévue · paiement non attesté",
      date: `${stock ? "Observation déclarée" : "Échéance"} : ${dateLabel(fact.dueDate)}`,
      referenceValue: fact.value.low !== null && fact.value.high !== null && fact.value.low !== fact.value.high
        ? `${money(fact.value.low)} à ${money(fact.value.high)}` : undefined };
  };
  const controlRow = (card: ComposerCardView): Row => {
    return { ...monthControlReading(model, card, stale), id: card.targetRef, targetRef: isOnBoard(card.targetRef) ? card.targetRef : undefined, label: card.label,
      targetNote: isOnBoard(card.targetRef) ? undefined : "Réservation publiée sans carte active sur le Board.",
      source: sources(Array.isArray(card.value.sourceRefs) ? card.value.sourceRefs as string[] : []), date: "Paiement : non attesté" };
  };
  const controls = model.board.baselineControls;
  const savings: Row[] = (facts?.savingsReservations ?? []).map(reservation => {
    const targetRef = `savings:${reservation.reservationId}`;
    const card = model.board.savings.find(item => item.targetRef === targetRef);
    const safety = reservation.reservationId === "policy:safety-reserve";
    return { id: targetRef, label: safety ? "Réserve de sécurité" : reservation.label,
      value: stale || !card ? money(reservation.amount) : money(card.value.amount), origin: stale || !card ? "PUBLISHED" : "SCENARIO",
      meaning: safety ? "Repère de prudence distinct des allocations de l’indicateur « Cagnottes réservées ». Les lignes ne forment pas un total à additionner."
        : "Réservation · pas un virement", caption: stale ? "Dernier montant publié" : safety ? "Distincte des cagnottes" : "Réservation",
      notice: stale ? "Dernière valeur connue · actualisation en attente. Le choix en attente n’est pas présenté comme une allocation actualisée." : undefined,
      knowledge: card ? knowledgeLabel(card.knowledge) : "Déclarée dans le mois",
      protected: reservation.adjustability === "PROTECTED" || card?.capability?.flexibility === "LOCKED",
      source: reservation.source === "ANNUAL_PLAN" ? "Plan annuel · réservation du mois" : sources(reservation.sourceRefs), date: `Échéance : ${dateLabel(reservation.dueDate)}`,
      referenceValue: money(reservation.amount), ...(card ? { targetRef: isOnBoard(targetRef) ? targetRef : undefined,
        targetNote: isOnBoard(targetRef) ? undefined : "Réservation publiée sans carte active sur le Board." } : {}) };
  });
  // Older UI models still retain every published reservation, even without the new metadata.
  for (const card of model.board.savings) if (!savings.some(row => row.id === card.targetRef)) {
    const reading = controlRow(card);
    savings.push({ ...reading, meaning: "Réservation · pas un virement",
      caption: stale ? reading.origin === "UNKNOWN" ? "Projection à recalculer" : "Dernier montant publié" : "Réservation",
      protected: card.capability?.flexibility === "LOCKED" });
  }
  const groups = [
    { key: "charges", label: "Charges prévues", rows: (model.board.structuralObligations ?? []).map(fact => factRow(fact, false)), empty: "Aucune charge publiée dans cette lecture." },
    { key: "resources", label: "Ressources", rows: (facts?.resources ?? []).map(fact => factRow(fact, true, fact.role === "STOCK_NOT_INCOME")), empty: "Détail des ressources non publié dans cette lecture." },
    { key: "groceries", label: "Courses", rows: controls.filter(card => facts?.controlDomains[card.targetRef] === "groceries").map(controlRow), empty: "Référence Courses non publiée." },
    { key: "tobacco", label: "Tabac", rows: controls.filter(card => facts?.controlDomains[card.targetRef] === "tobacco-vape").map(controlRow), empty: "Référence Tabac non publiée." },
    { key: "savings", label: "Épargne réservée", rows: savings, empty: "Aucune réservation publiée dans cette lecture." },
    { key: "envelopes", label: "Enveloppes publiées", rows: model.board.discretionaryControls.filter(card => controlValuePresentation(card).kind !== "UNKNOWN").map(controlRow), empty: "Aucune enveloppe publiée dans cette lecture." },
  ];
  return <section className={styles.monthRead} data-month-read data-month={month} aria-label="Lecture du mois">
    <p className={styles.monthReadPeriod}><strong>{monthLabel(month)}</strong> · Consultation</p>
    <p className={styles.monthReadNotice}>{facts ? `Connaissance arrêtée au ${dateLabel(facts.knowledgeCutoff)}.` : "Date de connaissance non publiée."}</p>
    {stale && <p className={styles.monthReadNotice} role="status">Actualisation en attente · les dernières valeurs publiées restent consultables. La projection reste à recalculer.</p>}
    <p className={styles.monthReadNotice}>Prévisions et réservations ne prouvent aucun paiement, encaissement ou virement.</p>
    {groups.map(group => <details key={group.key} name="composer-month-rubric" className={styles.monthReadGroup} data-month-group={group.key}>
      <summary><h3>{group.label}<span>{group.rows.length}</span></h3></summary>
      {group.key === "savings" && <p className={styles.monthReadNotice}>La réserve de sécurité est distincte des « Cagnottes réservées ». Aucun total des lignes n’est calculé ici.</p>}
      {group.rows.map(row => <details key={row.id} className={styles.monthReadRow} data-month-row={row.id} data-protected={row.protected || undefined} data-value-origin={row.origin}>
        <summary><span><strong>{row.label}</strong><small>{row.protected && <><LockKeyhole size={11} aria-hidden="true" /> Protégée · </>}{row.caption}</small></span><b>{row.value}</b></summary>
        <div className={styles.monthReadDetail}>
          <p>{row.meaning}</p>{row.notice && <p>{row.notice}</p>}<p>{row.knowledge} · {row.source}</p><p>Mois concerné : {monthLabel(month)} · {row.date}</p>
          {row.referencePeriod && <p>Référence : {row.referencePeriod}</p>}
          {row.referenceValue && <p>{group.key === "savings" ? "Montant déclaré" : "Repère publié"} : {row.referenceValue}</p>}
          {row.protected && <p>Protection conservée · aucune modification depuis cette consultation.</p>}
          {row.targetNote && <p>{row.targetNote}</p>}
          {group.key === "groceries" && decide && controls.filter(card => card.targetRef === row.id).map(card =>
            <CoursesMonthTarget key={`${month}:${card.targetRef}`} model={model} card={card} busy={busy} decide={decide} />)}
          {row.targetRef && <button type="button" data-month-target={row.targetRef} aria-current={focused === row.targetRef ? "true" : undefined}
            onClick={() => { if (row.targetRef) focus(row.targetRef); }}>Voir la carte sur le Board</button>}
        </div>
      </details>)}
      {!group.rows.length && <p className={styles.monthReadNotice}>{group.empty}</p>}
    </details>)}
  </section>;
}
