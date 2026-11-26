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
    <span style={{ width: `${100 * funded / budget}%` }} />
    <span style={{ width: `${100 * planned / budget}%` }} />
  </div>;
}

export function ProjectSummary({ project, goals }: { project: SavingsProject; goals: readonly SavingsGoal[] }) {
  const total = summarizeSavingsGoals(goals);
  return <header className={styles.projectHeader}>
    <div className={styles.projectHeading}>
      <Image src={projectArt[project]} alt="" width={48} height={48} unoptimized />
      <h2 id={`savings-${project}`}>{savingsProjects[project]}</h2>
    </div>
    <dl className={styles.projectTotals}>
      <div><dt>{total.unpriced ? "Budget chiffré" : "Budget total"}</dt>
        <dd>{total.budget ? savingsMoney(total.budget) : "À chiffrer"}</dd></div>
      <div><dt>Déjà acheté</dt><dd>{savingsMoney(total.purchased)}</dd></div>
      <div><dt>Financement{total.unpriced && total.budget > 0 ? " chiffré" : ""}</dt>
        <dd>{total.percent === null ? "—" : `${total.percent} %`}</dd></div>
    </dl>
    <div className={styles.projectProgress}>
      <FundingTrack {...total} label={`Financement · ${savingsProjects[project]}`} />
      <p>{total.budget > 0 && <span>{savingsMoney(total.funded)} financés · {savingsMoney(total.planned)} prévus</span>}
        {total.unpriced > 0 && <span>{total.unpriced} {total.unpriced === 1 ? "poste à chiffrer" : "postes à chiffrer"}</span>}</p>
    </div>
  </header>;
}

export function TravelTopicSummary({ topic, goals }: { topic: SavingsTravelTopic; goals: readonly SavingsGoal[] }) {
  const total = summarizeSavingsGoals(goals);
  return <header className={styles.topicHeader}>
    <div className={styles.topicTitle}>
      <Image src={travelArt[topic]} alt="" width={46} height={46} unoptimized />
      <h3 id={`voyage-${topic}`}>{savingsTravelTopics[topic]}</h3>
    </div>
    <p className={styles.topicBudget}><strong>{total.budget ? savingsMoney(total.budget) : "À chiffrer"}</strong>
      {total.percent !== null && <span>{total.percent} % financés{total.unpriced > 0 ? " sur les postes chiffrés" : ""}</span>}</p>
    <FundingTrack {...total} label={`Financement · ${savingsTravelTopics[topic]}`} />
    {(total.purchased > 0 || total.unpriced > 0) && <p className={styles.footnote}>
      {[total.purchased > 0 ? `${savingsMoney(total.purchased)} achetés` : null,
        total.unpriced > 0 ? `${total.unpriced} ${total.unpriced === 1 ? "poste à chiffrer" : "postes à chiffrer"}` : null].filter(Boolean).join(" · ")}
    </p>}
  </header>;
}
