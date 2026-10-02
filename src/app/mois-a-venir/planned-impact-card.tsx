import type { previewPlannedExpense } from "./planned-expenses-actions";
import styles from "./project-wizard.module.css";
type Preview = Extract<Awaited<ReturnType<typeof previewPlannedExpense>>, { ok: true }>["value"];
const money = (v: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(v));
export function PlannedImpactCard({ preview, fundingIncomplete }: { preview: Preview; fundingIncomplete: boolean }) {
  const partial = preview.projectionIncomplete || preview.unpricedComponents.length > 0;
  return <>
    <div className={styles.previewGrid} aria-label="Effet sur notre mois"><section className={styles.previewCard}><h4>Coût économique du projet</h4><p className={styles.previewNumber}>{preview.unpricedComponents.length > 0 && Number(preview.grossCost) === 0 ? "À préciser" : `${preview.unpricedComponents.length > 0 ? "≥ " : ""}${money(preview.grossCost)}`}</p>
      {preview.unpricedComponents.length > 0 && <p className={styles.small}>Budget à compléter : {preview.unpricedComponents.join(", ")}</p>}
      {Number(preview.fuelUsage) > 0 && <p className={styles.small}>Dont {money(preview.fuelUsage)} d’essence utilisée, sans plein bancaire prévu.</p>}</section>
      <section className={styles.previewCard}><h4>Paiements réellement prévus</h4><dl>{([ ["Banque", preview.projectPayment.bank], ["Swile", preview.projectPayment.swile], ["Edenred", preview.projectPayment.edenred] ] as const).filter(([, value]) => Number(value) > 0).map(([label, value]) => <div key={label} className={styles.summaryRow}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
        {Number(preview.payableGross) === 0 && <p className={styles.small}>Aucun paiement chiffré.</p>}{fundingIncomplete && <p className={styles.small}>Financement à compléter.</p>}
        {([ ["Swile", preview.funding.swile], ["Edenred", preview.funding.edenred] ] as const).filter(([, p]) => Number(p.shortfall) > 0).map(([label, p]) => <p key={label} className={styles.error}>{label} : {money(p.shortfall)} à financer autrement.</p>)}</section></div>
    <p className={styles.previewNarrative}>{preview.unpricedComponents.length > 0 ? `Effet des coûts connus : ${preview.effectNarrative} Les éléments non chiffrés ne sont pas comptés comme gratuits.` : preview.effectNarrative}</p>
    <dl className={styles.previewStats}><div><dt>Disponible réel</dt><dd>{preview.availableNow.status === "AVAILABLE" ? money(preview.availableNow.value) : "Non renseigné"}</dd></div><div><dt>Disponible prévu</dt><dd>{money(preview.plannedAvailable)}</dd></div><div><dt>Estimé en fin de mois</dt><dd>≈ {money(preview.estimatedEndOfMonth)}</dd></div></dl>
    {partial && <p className={styles.small}>Projection partielle · {preview.unpricedComponents.length ? "certains budgets restent inconnus" : "imports du mois incomplets"}. Les valeurs connues restent affichées.</p>}
    <details className={styles.previewDetails}><summary>Comprendre les montants</summary><p>{preview.explanation} Le disponible prévu et la fin de mois sont des projections économiques, distinctes d’un solde bancaire.</p>
      {preview.availableNow.status === "UNAVAILABLE" && <p>Le disponible réel nécessite un solde de départ et des mouvements couvrant la période.</p>}
      <p>Fin de mois : {money(preview.after.lowConsumption)} dans un mois plus léger, {money(preview.after.highConsumption)} dans un mois plus coûteux.</p>
      <p>{preview.economicLines.map(l => `${l.label} : ${money(l.amount)}${l.economicOnly ? " (usage économique)" : ""}`).join(" · ")}</p></details>
  </>;
}
