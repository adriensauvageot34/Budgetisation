import { LockKeyhole } from "lucide-react";
import type { ComposerCardView } from "@/domain/phase2/planner/composer-contract";
import type { ComposerUiModel } from "@/domain/phase2/planner/composer-ui-contract";
import type { BaselineStructuralFact } from "@/domain/phase2/planner/baseline-contract";
import { controlValuePresentation, controlValueSummary } from "./control-value-presentation";
import { knowledgeLabel, money, monthLabel } from "./display";
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
  date: string; source: string; referencePeriod?: string; referenceValue?: string; protected?: boolean; targetRef?: string }>;

export function ComposerMonthRead({ model, stale, focused, focus }: {
  model: ComposerUiModel; stale: boolean; focused: string | null; focus: (ref: string) => void;
}) {
  const month = model.board.targetMonth;
  const facts = model.monthRead?.targetMonth === month ? model.monthRead : undefined;
  const sources = (refs: readonly string[]) => {
    const labels = refs.flatMap(ref => facts?.sourceOwners[ref] ? [sourceLabel(facts.sourceOwners[ref])] : []);
    return [...new Set(labels)].join(" · ") || "Source non détaillée";
  };
  const factRow = (fact: BaselineStructuralFact, resource: boolean): Row => {
    const stock = fact.metadata.role === "STOCK_NOT_INCOME";
    const funding = fact.factKey === "benefit:swile" ? "Swile" : fact.factKey === "benefit:edenred" ? "Edenred" : null;
    return { id: fact.factKey, label: stock ? "Solde bancaire déclaré" : funding ? `Financement ${funding}` : fact.label,
      value: money(fact.value.central), knowledge: knowledgeLabel(fact.knowledge), source: sources(fact.sourceRefs),
      caption: stock ? "Stock déclaré" : funding ? "Financement prévu" : fact.knowledge === "DECLARED" ? "Montant déclaré" : "Montant prévu",
      meaning: stock ? "Stock déclaré · pas un revenu" : funding ? "Financement prévu · pas un revenu bancaire"
        : resource ? "Ressource prévue · encaissement non attesté" : "Charge prévue · paiement non attesté",
      date: `${stock ? "Observation déclarée" : "Échéance"} : ${dateLabel(fact.dueDate)}`,
      referenceValue: fact.value.low !== null && fact.value.high !== null && fact.value.low !== fact.value.high
        ? `${money(fact.value.low)} à ${money(fact.value.high)}` : undefined };
  };
  const controlRow = (card: ComposerCardView): Row => {
    const published = controlValuePresentation(card);
    const history = model.cardKnowledge[`control:${card.targetRef}`]?.dimensions.find(dimension => ["MONTH_AMOUNT", "OCCURRENCE_COUNT"].includes(dimension.key));
    return { id: card.targetRef, targetRef: card.targetRef, label: card.label,
      value: stale ? "À recalculer" : controlValueSummary(card), meaning: published.label, caption: published.shortLabel,
      knowledge: knowledgeLabel(history?.evidenceState ?? card.knowledge), source: sources(Array.isArray(card.value.sourceRefs) ? card.value.sourceRefs as string[] : []),
      date: "Paiement : non attesté",
      referencePeriod: history?.coverageFrom && history.coverageTo ? `${monthLabel(history.coverageFrom)} → ${monthLabel(history.coverageTo)}` : "Période de référence non publiée",
      referenceValue: history?.unit === "EUR_PER_MONTH" ? money(history.value) : undefined };
  };
  const controls = model.board.baselineControls;
  const savings: Row[] = (facts?.savingsReservations ?? []).map(reservation => {
    const targetRef = `savings:${reservation.reservationId}`;
    const card = model.board.savings.find(item => item.targetRef === targetRef);
    return { id: targetRef, label: reservation.reservationId === "policy:safety-reserve" ? "Réserve de sécurité" : reservation.label,
      value: card ? stale ? "À recalculer" : money(card.value.amount) : money(reservation.amount),
      meaning: "Réservation · pas un virement", caption: "Réservation", knowledge: card ? knowledgeLabel(card.knowledge) : "Déclarée dans le mois",
      protected: reservation.adjustability === "PROTECTED" || card?.capability?.flexibility === "LOCKED",
      source: reservation.source === "ANNUAL_PLAN" ? "Plan annuel · réservation du mois" : sources(reservation.sourceRefs), date: `Échéance : ${dateLabel(reservation.dueDate)}`,
      referenceValue: money(reservation.amount), ...(card ? { targetRef } : {}) };
  });
  // Older UI models still retain every published reservation, even without the new metadata.
  for (const card of model.board.savings) if (!savings.some(row => row.id === card.targetRef)) savings.push({
    ...controlRow(card), meaning: "Réservation · pas un virement", caption: "Réservation", protected: card.capability?.flexibility === "LOCKED" });
  const groups = [
    { key: "charges", label: "Charges prévues", rows: (model.board.structuralObligations ?? []).map(fact => factRow(fact, false)), empty: "Aucune charge publiée dans cette lecture." },
    { key: "resources", label: "Ressources", rows: (facts?.resources ?? []).map(fact => factRow(fact, true)), empty: "Détail des ressources non publié dans cette lecture." },
    { key: "groceries", label: "Courses", rows: controls.filter(card => facts?.controlDomains[card.targetRef] === "groceries").map(controlRow), empty: "Référence Courses non publiée." },
    { key: "tobacco", label: "Tabac", rows: controls.filter(card => facts?.controlDomains[card.targetRef] === "tobacco-vape").map(controlRow), empty: "Référence Tabac non publiée." },
    { key: "savings", label: "Épargne réservée", rows: savings, empty: "Aucune réservation publiée dans cette lecture." },
    { key: "envelopes", label: "Enveloppes publiées", rows: model.board.discretionaryControls.filter(card => controlValuePresentation(card).kind !== "UNKNOWN").map(controlRow), empty: "" },
  ];
  return <section className={styles.monthRead} data-month-read data-month={month} aria-label="Lecture du mois">
    <p className={styles.monthReadPeriod}><strong>{monthLabel(month)}</strong> · Consultation</p>
    <p className={styles.monthReadNotice}>{facts ? `Connaissance arrêtée au ${dateLabel(facts.knowledgeCutoff)}.` : "Date de connaissance non publiée."}
      {stale && " Actualisation en attente : les faits de la dernière lecture restent visibles, les choix sont à recalculer."}</p>
    <p className={styles.monthReadNotice}>Prévisions et réservations ne prouvent aucun paiement, encaissement ou virement.</p>
    {groups.filter(group => group.key !== "envelopes" || group.rows.length > 0).map(group => <section key={group.key} className={styles.monthReadGroup} data-month-group={group.key}>
      <h3>{group.label}<span>{group.rows.length}</span></h3>
      {group.rows.map(row => <details key={row.id} className={styles.monthReadRow} data-month-row={row.id} data-protected={row.protected || undefined}>
        <summary><span><strong>{row.label}</strong><small>{row.protected && <><LockKeyhole size={11} aria-hidden="true" /> Protégée · </>}{row.caption}</small></span><b>{row.value}</b></summary>
        <div className={styles.monthReadDetail}>
          <p>{row.meaning}</p><p>{row.knowledge} · {row.source}</p><p>Mois concerné : {monthLabel(month)} · {row.date}</p>
          {row.referencePeriod && <p>Référence : {row.referencePeriod}</p>}
          {row.referenceValue && <p>{group.key === "savings" ? "Montant déclaré" : "Repère publié"} : {row.referenceValue}</p>}
          {row.protected && <p>Protection conservée · aucune modification depuis cette consultation.</p>}
          {row.targetRef && <button type="button" data-month-target={row.targetRef} aria-current={focused === row.targetRef ? "true" : undefined}
            onClick={() => { if (row.targetRef) focus(row.targetRef); }}>Voir la carte sur le Board</button>}
        </div>
      </details>)}
      {!group.rows.length && <p className={styles.monthReadNotice}>{group.empty}</p>}
    </section>)}
  </section>;
}
