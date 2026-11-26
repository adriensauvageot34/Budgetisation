import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowUpRight, CalendarDays, ChevronDown, Plus, WalletCards } from "lucide-react";
import { withProductAuthentication } from "@/app/product-query";
import { forecastWindowMonths } from "@/app/mois-a-venir/month-entry";
import { getBootstrapSession } from "@/server/bootstrap/context";
import { planningDate } from "@/server/phase2/planning-date";
import { readSavingsGoals } from "@/server/phase2/savings-goals";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { readActiveComposerDraft } from "@/server/phase2/planner/composer-draft-service";
import { resolveEffectiveMonthScenario } from "@/server/phase2/planner/effective-month-scenario";
import { readMonthComposer } from "@/server/phase2/planner/read-model";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { savingsEuros, savingsGoalProgress, savingsMoney, savingsProjects, savingsStatuses, savingsTemplates,
  type SavingsGoal, type SavingsGoalAllocation, type SavingsProject } from "@/domain/phase2/savings-goals";
import { addSavingsTemplates, changeSavingsAllocation, saveSavingsGoal } from "./actions";
import styles from "./savings.module.css";

export const metadata = { title: "Centre des cagnottes" };
export const dynamic = "force-dynamic";

const art: Record<SavingsProject, string> = {
  birthday: "/planned-visuals/composer/presets/gift-present.webp",
  christmas: "/planned-visuals/builder/clay/misc/gift.webp",
  travel: "/planned-visuals/builder/clay/intent/travel.webp",
  other: "/analyse-globale/clay/expenses.webp",
};
const projects = Object.keys(savingsProjects) as SavingsProject[];
const monthLabel = (month: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${month}-01T12:00:00Z`));
const dateLabel = (date: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${date}T12:00:00Z`));
const composerHref = (month: string) => `/mois-a-venir/composer?month=${month}&view=edition`;
const notices: Record<string, string> = {
  saved: "Modifications enregistrées.",
  amount: "Renseigne un montant positif avec deux décimales au maximum.",
  allocation: "Le total affecté doit tenir dans l’objectif. Vérifie aussi les mois prévus avant l’échéance.",
  month: "Choisis un mois disponible avant ou pendant le mois de l’échéance.",
  stale: "La cagnotte a changé depuis son ouverture. Les derniers montants sont affichés.",
  fields: "Vérifie le nom, le projet et la date.",
  unavailable: "L’enregistrement est indisponible pour le moment.",
};

export default async function SavingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ context, session }, params] = await Promise.all([withProductAuthentication(getBootstrapSession), searchParams]);
  if (!context.household) notFound();
  const today = planningDate(context.household.timezone);
  const months = forecastWindowMonths.filter(month => month >= today.slice(0, 7));
  const month = typeof params.month === "string" && months.includes(params.month) ? params.month : months[0];
  const goals = await readSavingsGoals(session.supabase, context.household.householdId);
  const filled = goals.filter(goal => savingsGoalProgress(goal).complete);
  const completed = params.view === "complete";
  const visible = completed ? filled : goals.filter(goal => !savingsGoalProgress(goal).complete);
  const totals = goals.reduce((sum, goal) => {
    const progress = savingsGoalProgress(goal);
    return { saved: sum.saved + progress.saved, purchased: sum.purchased + progress.purchased,
      planned: sum.planned + progress.planned };
  }, { saved: 0, purchased: 0, planned: 0 });
  const assigned = goals.flatMap(goal => goal.allocations).filter(row => row.month === month && !row.accounted)
    .reduce((sum, row) => sum + row.cents, 0);
  const notice = typeof params.notice === "string" && Object.hasOwn(notices, params.notice) ? notices[params.notice] : undefined;
  const hasNewTemplates = savingsTemplates.some(template => !goals.some(goal => goal.templateKey === template.key));
  const viewHref = (view: string) => `/cagnottes?${new URLSearchParams({ ...(month ? { month } : {}), view })}`;

  return <div className={styles.workspace}>
    <header className={styles.hero}>
      <div><h1>Cagnottes</h1><p>Préparer les cadeaux, le voyage et les dépenses hors quotidien.</p></div>
      <details className={styles.newGoal}>
        <summary className={styles.primary}><Plus size={18} aria-hidden /> Nouvelle cagnotte</summary>
        <GoalForm month={month} />
      </details>
    </header>
    {notice && <p className={styles.notice} data-error={params.notice !== "saved"} role="status">{notice}</p>}
    <div className={styles.overview}>
      <section aria-label="Suivi des cagnottes" className={styles.totals}>
        <div><span>Sur le livret</span><strong>{savingsMoney(totals.saved)}</strong></div>
        <div><span>Déjà acheté</span><strong>{savingsMoney(totals.purchased)}</strong></div>
        <div><span>Affecté à un mois</span><strong>{savingsMoney(totals.planned)}</strong></div>
      </section>
      {month && <section className={styles.monthPanel} aria-label="Marge du mois">
        <form className={styles.monthSelector} action="/cagnottes">
          <CalendarDays size={18} aria-hidden />
          {completed && <input type="hidden" name="view" value="complete" />}
          <MonthSelect months={months} selected={month} />
          <button className={styles.quiet}>Voir la marge</button>
        </form>
        <Suspense key={month} fallback={<p className={styles.muted}>Calcul de la marge du mois…</p>}>
          <MonthBalance month={month} reserved={assigned} />
        </Suspense>
      </section>}
    </div>
    <div className={styles.listBar}>
      <nav aria-label="État des cagnottes" className={styles.tabs}>
        <Link href={viewHref("active")} aria-current={!completed ? "page" : undefined}>En cours <span>{goals.length - filled.length}</span></Link>
        <Link href={viewHref("complete")} aria-current={completed ? "page" : undefined}>Remplies <span>{filled.length}</span></Link>
      </nav>
      {!completed && hasNewTemplates && <form action={addSavingsTemplates}>
        <input type="hidden" name="returnMonth" value={month ?? ""} />
        <button className={styles.quiet}><Plus size={15} aria-hidden /> Ajouter les postes de départ</button>
      </form>}
    </div>
    {visible.length === 0 && <section className={styles.empty}>
      <Image src={art[completed ? "other" : "travel"]} width={84} height={70} alt="" />
      <h2>{completed ? "Aucune cagnotte remplie" : "Quels projets veux-tu financer ?"}</h2>
      <p>{completed ? "Les cagnottes financées par des achats ou par le livret apparaîtront ici."
        : goals.length ? "Tes cagnottes sont dans l’onglet Remplies." : "Ajoute les postes de départ pour les anniversaires, Noël et le voyage, ou crée ta première cagnotte."}</p>
    </section>}
    {projects.map(project => {
      const cards = visible.filter(goal => goal.project === project);
      if (!cards.length) return null;
      return <section className={styles.group} key={project} aria-labelledby={`savings-${project}`}>
        <h2 id={`savings-${project}`}>{savingsProjects[project]}</h2>
        <div className={styles.cards}>{cards.map(goal =>
          <GoalCard key={goal.goalId} goal={goal} months={months} month={month} today={today} selected={params.goal === goal.goalId} />)}</div>
      </section>;
    })}
  </div>;
}

async function MonthBalance({ month, reserved }: { month: string; reserved: number }) {
  let remainder: string | null = null;
  try {
    const planner = await authorizedPlanner({ readCacheMonth: month });
    const draft = composerDraftAutosaveEnabledFor(planner.userId) ? await readActiveComposerDraft(planner, month) : null;
    remainder = draft
      ? (await readMonthComposer(planner.deps, planner.householdId, month, draft.semanticState)).board.cockpit.plan.economicMonthEndRemainder
      : (await resolveEffectiveMonthScenario(planner.deps, planner.householdId, month)).scenario.economicPlan?.scenarios.central ?? null;
  } catch { /* The workspace remains usable when the month forecast is temporarily unavailable. */ }
  const balance = remainder === null ? null : Math.round(Number(remainder) * 100);
  return <div className={styles.monthBalance}>
    <p><span>Réservé dans ce mois</span><strong>{savingsMoney(reserved)}</strong></p>
    <p data-negative={balance !== null && balance < 0}><span>Marge prévisionnelle après réservations</span>
      <strong>{balance === null ? "À préciser" : savingsMoney(balance)}</strong></p>
    {balance !== null && balance < 0 && <small className={styles.warning}>Marge négative. Ouvre une ligne « Prévu » pour reporter tout ou partie du montant.</small>}
    <Link className={styles.textLink} href={composerHref(month)} prefetch={false}>Ouvrir le mois dans Composer <ArrowUpRight size={14} aria-hidden /></Link>
  </div>;
}

function GoalCard({ goal, months, month, today, selected }: { goal: SavingsGoal; months: readonly string[]; month?: string; today: string; selected: boolean }) {
  const progress = savingsGoalProgress(goal);
  const target = goal.targetCents ?? 0;
  const payableMonths = months.filter(item => !goal.deadline || item <= goal.deadline.slice(0, 7));
  const allocations = [...goal.allocations].sort((a, b) => a.month.localeCompare(b.month) || a.id.localeCompare(b.id));
  return <article className={styles.card} data-project={goal.project}>
    <div className={styles.cardIntro}>
      <Image src={art[goal.project]} width={53} height={53} alt="" />
      <div><h3>{goal.label}</h3>
        <p className={goal.deadline && goal.deadline < today && !progress.complete ? styles.warning : styles.muted}>
          {goal.deadline ? dateLabel(goal.deadline) : "Échéance à préciser"}</p></div>
    </div>
    <div className={styles.cardMoney}>
      <strong>{target ? savingsMoney(progress.funded) : "Objectif à chiffrer"}</strong>
      {target > 0 && <span>sur {savingsMoney(target)}</span>}
    </div>
    {target > 0 && <div className={styles.track} aria-label={`${savingsMoney(progress.funded)} financés et ${savingsMoney(progress.planned)} prévus`}>
      <span style={{ width: `${progress.funded / target * 100}%` }} /><span style={{ width: `${progress.planned / target * 100}%` }} />
    </div>}
    <p className={styles.footnote}>{progress.complete ? "Remplie" : (progress.unassigned ?? 0) > 0 ? `${savingsMoney(progress.unassigned!)} à affecter`
      : progress.planned > 0 ? `${savingsMoney(progress.planned)} prévus` : "Montant à renseigner"}</p>
    <details open={selected || undefined} className={styles.details}>
      <summary>{target ? "Affectations et suivi" : "Configurer la cagnotte"} <ChevronDown size={15} aria-hidden /></summary>
      {allocations.length > 0 && <div className={styles.allocations}>{allocations.map(row =>
        <Allocation key={row.id} goal={goal} row={row} months={payableMonths} currentMonth={month} />)}</div>}
      {(progress.unassigned ?? 0) > 0 && payableMonths.length > 0 && <form action={changeSavingsAllocation} className={styles.form}>
        <GoalFields goal={goal} month={month} />
        <label>Mois à financer<MonthSelect months={payableMonths} selected={month} /></label>
        <label>Montant partiel en euros<input name="amount" inputMode="decimal" placeholder="0,00" /></label>
        <div className={styles.actions}><button name="operation" value="add" className={styles.quiet}>Affecter ce montant</button>
          <button name="operation" value="all" className={styles.primary}>Affecter les {savingsMoney(progress.unassigned!)}</button></div>
      </form>}
      {(progress.unassigned ?? 0) > 0 && !payableMonths.length && <p className={styles.warning}>Aucun mois ouvert avant l’échéance.</p>}
      {target > 0 ? <details className={styles.details}><summary>Modifier l’objectif <ChevronDown size={15} aria-hidden /></summary>
        <GoalForm goal={goal} month={month} /></details> : <GoalForm goal={goal} month={month} />}
    </details>
  </article>;
}

function Allocation({ goal, row, months, currentMonth }: { goal: SavingsGoal; row: SavingsGoalAllocation; months: readonly string[]; currentMonth?: string }) {
  const otherMonths = months.filter(month => month !== row.month);
  return <details className={styles.allocation}>
    <summary><span>{monthLabel(row.month)} <small data-status={row.status}>{savingsStatuses[row.status]}</small></span>
      <strong>{savingsMoney(row.cents)}</strong></summary>
    <form action={changeSavingsAllocation} className={styles.form}>
      <GoalFields goal={goal} month={currentMonth} /><input type="hidden" name="allocationId" value={row.id} />
      <label>État<select name="status" defaultValue={row.status}>
        {Object.entries(savingsStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Montant concerné en euros<input name="amount" inputMode="decimal" required defaultValue={savingsEuros(row.cents)} /></label>
      <label className={styles.check}><input type="checkbox" name="accounted" defaultChecked={row.accounted} /> Déjà compté dans le budget de ce mois</label>
      <button className={styles.quiet} name="operation" value="status">Enregistrer l’état</button>
    </form>
    {row.status === "planned" && otherMonths.length > 0 && <form action={changeSavingsAllocation} className={styles.form}>
      <GoalFields goal={goal} month={currentMonth} /><input type="hidden" name="allocationId" value={row.id} />
      <label>Reporter vers<MonthSelect months={otherMonths} /></label>
      <label>Montant à reporter en euros<input name="amount" inputMode="decimal" required defaultValue={savingsEuros(row.cents)} /></label>
      <button className={styles.quiet} name="operation" value="move">Reporter le montant</button>
    </form>}
    <div className={styles.allocationFooter}><Link className={styles.textLink} prefetch={false} href={composerHref(row.month)}>Voir dans Composer <ArrowUpRight size={14} aria-hidden /></Link>
      {row.status === "planned" && <form action={changeSavingsAllocation}>
        <GoalFields goal={goal} month={currentMonth} /><input type="hidden" name="allocationId" value={row.id} />
        <button className={styles.quiet} name="operation" value="release">Désaffecter</button>
      </form>}
    </div>
  </details>;
}

function GoalFields({ goal, month }: { goal?: SavingsGoal; month?: string }) {
  return <><input type="hidden" name="returnMonth" value={month ?? ""} />
    {goal && <><input type="hidden" name="goalId" value={goal.goalId} /><input type="hidden" name="revision" value={goal.revision} /></>}</>;
}

function GoalForm({ goal, month }: { goal?: SavingsGoal; month?: string }) {
  return <form action={saveSavingsGoal} className={styles.form}>
    <GoalFields goal={goal} month={month} />
    <label>Nom de la cagnotte<input name="label" required maxLength={100} defaultValue={goal?.label} placeholder="Ex. cadeau de Noël pour…" /></label>
    <label>Projet<select name="project" defaultValue={goal?.project ?? "other"}>
      {projects.map(project => <option key={project} value={project}>{savingsProjects[project]}</option>)}</select></label>
    <label>Objectif en euros<input name="target" inputMode="decimal" defaultValue={goal?.targetCents == null ? "" : savingsEuros(goal.targetCents)} /></label>
    <label>Échéance<input name="deadline" type="date" defaultValue={goal?.deadline ?? ""} /></label>
    <button className={styles.primary}>{goal ? "Enregistrer l’objectif" : "Créer la cagnotte"}</button>
  </form>;
}

function MonthSelect({ months, selected }: { months: readonly string[]; selected?: string }) {
  return <select name="month" aria-label="Mois" defaultValue={selected && months.includes(selected) ? selected : months[0]}>
    {months.map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}</select>;
}
