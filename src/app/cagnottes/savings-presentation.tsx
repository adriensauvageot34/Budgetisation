import Image from "next/image";
import { savingsMoney, savingsProjects, savingsProgressPercent, savingsTravelTopics, summarizeSavingsGoals,
  type SavingsGoal, type SavingsProject, type SavingsTravelTopic } from "@/domain/phase2/savings-goals";
import styles from "./savings.module.css";

export const projectArt: Record<SavingsProject, string> = {
  birthday: "/planned-visuals/builder/clay/social/birthday.webp",
  christmas: "/planned-visuals/composer/presets/gift-present.webp",
  travel: "/planned-visuals/builder/clay/intent/travel.webp",
  other: "/analyse-globale/clay/expenses.webp",
};

const travelArt: Record<SavingsTravelTopic, string> = {
  flights: "/planned-visuals/builder/clay/transport/plane.webp",
  bags: projectArt.travel,
  equipment: "/analyse-globale/clay/categories.webp",
  documents: "/planned-visuals/builder/clay/misc/document.webp",
  other: projectArt.travel,
};

export const savingsProjectKeys = Object.keys(savingsProjects) as SavingsProject[];
export const savingsTravelTopicKeys = Object.keys(savingsTravelTopics) as SavingsTravelTopic[];

export function goalArt(goal: SavingsGoal) {
  return goal.project === "travel" ? travelArt[goal.travelTopic ?? "other"] : projectArt[goal.project];
}

export function FundingTrack({ budget, funded, planned, label }: {
  budget: number; funded: number; planned: number; label: string;
}) {
  const percent = savingsProgressPercent(funded, budget);
  if (percent === null) return null;
  return <div className={styles.track} role="progressbar" aria-label={label} aria-valuenow={percent}
    aria-valuemin={0} aria-valuemax={100}
    aria-valuetext={`${savingsMoney(funded)} financés sur ${savingsMoney(budget)} · ${savingsMoney(planned)} prévus`}>
    <span style={{ width: `${100 * Math.min(budget, funded) / budget}%` }} />
    <span style={{ width: `${100 * Math.min(Math.max(0, budget - funded), planned) / budget}%` }} />
  </div>;
}

function ProjectAmounts({ total }: { total: ReturnType<typeof summarizeSavingsGoals> }) {
  return <dl className={styles.projectTotals}>
    <div><dt>{total.unpriced && total.budget ? "Budget cible chiffré" : "Budget cible"}</dt>
      <dd>{total.budget || !total.unpriced ? savingsMoney(total.budget) : "À chiffrer"}</dd></div>
    <div><dt>Déjà acheté</dt><dd>{savingsMoney(total.purchased)}</dd></div>
    <div><dt>Disponible sur le livret</dt><dd>{savingsMoney(total.saved)}</dd></div>
    <div><dt>Reste à financer</dt><dd>{total.unpriced && !total.budget ? "À chiffrer" : savingsMoney(total.remaining)}</dd></div>
  </dl>;
}

function ProgressSummary({ total, label }: { total: ReturnType<typeof summarizeSavingsGoals>; label: string }) {
  return <div className={styles.projectProgress}>
    <p>
      {total.percent !== null && <span>{total.percent} % financés{total.unpriced > 0 ? " sur les postes chiffrés" : ""}</span>}
      {total.count > 0 && <span className={styles.purchaseCount}>{total.completed} sur {total.count} {total.count > 1 ? "achats terminés" : "achat terminé"}</span>}
      {total.unpriced > 0 && <span>{total.unpriced} {total.unpriced === 1 ? "poste à chiffrer" : "postes à chiffrer"}</span>}
      {total.estimated > 0 && <span>{total.estimated} {total.estimated === 1 ? "budget estimé" : "budgets estimés"}</span>}
      {total.optional > 0 && <span>{total.optional} {total.optional === 1 ? "poste facultatif" : "postes facultatifs"}</span>}
      {total.exceeded > 0 && <span className={styles.overrun}>{savingsMoney(total.exceeded)} de dépassement</span>}
    </p>
    <FundingTrack budget={total.budget} funded={total.covered} planned={total.plannedWithinTarget} label={`Financement · ${label}`} />
  </div>;
}

export function ProjectSummary({ project, goals, season }: { project: SavingsProject; goals: readonly SavingsGoal[]; season?: number }) {
  const total = summarizeSavingsGoals(goals);
  return <header className={styles.projectHeader}>
    <div className={styles.projectHeading}>
      <Image src={projectArt[project]} alt="" width={48} height={48} unoptimized />
      <h2 id={`savings-${project}`}>{savingsProjects[project]}{season && ` ${season}`}</h2>
    </div>
    <ProjectAmounts total={total} />
    <ProgressSummary total={total} label={savingsProjects[project]} />
  </header>;
}

export function TravelTopicSummary({ topic, goals }: { topic: SavingsTravelTopic; goals: readonly SavingsGoal[] }) {
  const total = summarizeSavingsGoals(goals);
  return <header className={styles.topicHeader}>
    <div className={styles.topicTitle}>
      <Image src={travelArt[topic]} alt="" width={46} height={46} unoptimized />
      <h3 id={`voyage-${topic}`}>{savingsTravelTopics[topic]}</h3>
    </div>
    <ProjectAmounts total={total} />
    <ProgressSummary total={total} label={savingsTravelTopics[topic]} />
  </header>;
}
