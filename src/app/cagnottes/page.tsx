import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowUpRight, CalendarDays, ChevronDown, Plus } from "lucide-react";
import { withProductAuthentication } from "@/app/product-query";
import { forecastWindowMonths } from "@/app/mois-a-venir/month-entry";
import { getBootstrapSession } from "@/server/bootstrap/context";
import { planningDate } from "@/server/phase2/planning-date";
import { readSavingsGoals } from "@/server/phase2/savings-goals";
import { readSavingsMargin } from "@/server/phase2/savings-margin";
import { effectiveSavingsAllocations, savingsBudgetKinds, savingsEuros, savingsGoalProgress, savingsLivretUsed, savingsMoney, savingsPriorities, savingsProgressPercent, savingsProjects, savingsStatuses, savingsTemplates,
  summarizeSavingsGoals, type SavingsGoal, type SavingsGoalAllocation } from "@/domain/phase2/savings-goals";
import { savingsDeadlineGap, savingsFundingDate, savingsFundingMonths } from "@/domain/phase2/savings-schedule";
import { JULY_COMPOSER_MONTH, JULY_PILOT_DATE, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { realizedOperationCardId } from "@/app/mois-a-venir/composer/realized-card-view";
import { abandonSavingsGoal, addSavingsTemplates, changeSavingsAllocation, duplicateSavingsSeason, saveSavingsGoal, setSavingsPurchaseComplete } from "./actions";
import { GoalProjectFields } from "./goal-project-fields";
import { FundingTrack, goalArt, projectArt, ProjectSummary, savingsProjectKeys, savingsTravelTopicKeys, TravelTopicSummary } from "./savings-presentation";
import { SavingsFundingPlanner, SavingsPartialMove, SavingsReportSuggestions } from "./schedule-controls";
import styles from "./savings.module.css";

export const metadata = { title: "Centre des cagnottes" };
export const dynamic = "force-dynamic";

const monthLabel = (month: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${month}-01T12:00:00Z`));
const dateLabel = (date: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${date}T12:00:00Z`));
const composerHref = (month: string) => `/mois-a-venir/composer?month=${month}&view=edition`;
function purchaseHref(date: string, operationId: string) {
  const month = date.slice(0, 7);
  const href = realizedComposerHref(month, realizedOperationCardId(operationId));
  return month === JULY_COMPOSER_MONTH && date > JULY_PILOT_DATE ? `${href}&view=bilan` : href;
}
const notices: Record<string, string> = {
  saved: "Modifications enregistrées.",
  amount: "Renseigne un montant positif avec deux décimales au maximum.",
  allocation: "Le total affecté doit tenir dans l’objectif. Vérifie aussi les mois prévus avant l’échéance.",
  month: "Choisis un mois disponible avant ou pendant le mois de l’échéance.",
  stale: "La cagnotte a changé depuis son ouverture. Les derniers montants sont affichés.",
  fields: "Vérifie le nom, le projet et les dates. L’achat prévu doit précéder ou coïncider avec l’échéance.",
  livret: "Vérifie le solde du livret. Une somme déjà utilisée pour un achat doit rester couverte.",
  season: "Choisis une année ultérieure pour dupliquer ce projet.",
  unavailable: "L’enregistrement est indisponible pour le moment.",
};

export default async function SavingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ context, session }, params] = await Promise.all([withProductAuthentication(getBootstrapSession), searchParams]);
  if (!context.household) notFound();
  const today = planningDate(context.household.timezone);
  const months = forecastWindowMonths.filter(month => month >= today.slice(0, 7));
  const month = typeof params.month === "string" && months.includes(params.month) ? params.month : months[0];
  const goals = await readSavingsGoals(session.supabase, context.household.householdId);
  const year = Number(today.slice(0, 4));
  const requestedSeason = typeof params.season === "string" && /^20\d{2}$/u.test(params.season) ? Number(params.season) : undefined;
  const selectedGoal = goals.find(goal => goal.goalId === params.goal);
  const requestedView = params.view === "complete" || params.view === "archived" || params.view === "active" ? params.view : undefined;
  const stateOf = (goal: SavingsGoal) => goal.abandoned ? "archived" : goal.purchasedComplete ? "complete" : "active";
  const view = requestedView ?? (selectedGoal ? stateOf(selectedGoal) : "active");
  const groups = savingsProjectKeys.flatMap(project => {
    const all = goals.filter(goal => goal.project === project);
    if (!all.length) return [];
    const seasons = [...new Set(all.flatMap(goal => goal.season ? [goal.season] : []))].sort((a, b) => b - a);
    const season = selectedGoal?.project === project && selectedGoal.season ? selectedGoal.season
      : requestedSeason && seasons.includes(requestedSeason) ? requestedSeason : seasons.includes(year) ? year : seasons[0];
    return [{ project, goals: all.filter(goal => !season || goal.season === season), season, seasons }];
  });
  const displayed = groups.flatMap(group => group.goals);
  const active = displayed.filter(goal => stateOf(goal) === "active");
  const completed = displayed.filter(goal => stateOf(goal) === "complete");
  const archived = displayed.filter(goal => stateOf(goal) === "archived");
  const visible = (view === "complete" ? completed : view === "archived" ? archived : active)
    .sort((a, b) => (savingsFundingDate(a) ?? "9999").localeCompare(savingsFundingDate(b) ?? "9999"));
  const totals = summarizeSavingsGoals(goals);
  const assigned = goals.flatMap(effectiveSavingsAllocations).filter(row => row.month === month && !row.accounted)
    .reduce((sum, row) => sum + row.cents, 0);
  const notice = typeof params.notice === "string" && Object.hasOwn(notices, params.notice) ? notices[params.notice] : undefined;
  const hasNewTemplates = savingsTemplates.some(template => !goals.some(goal => goal.templateKey === template.key));
  const viewHref = (view: string, season = requestedSeason) => `/cagnottes?${new URLSearchParams({
    ...(month ? { month } : {}), ...(season ? { season: String(season) } : {}), view,
  })}`;
  const destinations = goals.filter(goal => stateOf(goal) === "active")
    .map(goal => ({ id: goal.goalId, label: [savingsProjects[goal.project], goal.season, goal.label].filter(Boolean).join(" · ") }));

  return <div className={styles.workspace}>
    <header className={styles.hero}>
      <div><h1>Cagnottes</h1><p>Préparer les cadeaux, le voyage et les dépenses hors quotidien.</p></div>
      <details className={styles.newGoal}>
        <summary className={styles.primary}><Plus size={18} aria-hidden /> Nouvelle cagnotte</summary>
        <GoalForm month={month} year={requestedSeason ?? year} />
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
          <input type="hidden" name="view" value={view} />
          {requestedSeason && <input type="hidden" name="season" value={requestedSeason} />}
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
        <Link href={viewHref("active")} aria-current={view === "active" ? "page" : undefined}>En cours <span>{active.length}</span></Link>
        <Link href={viewHref("complete")} aria-current={view === "complete" ? "page" : undefined}>Achats terminés <span>{completed.length}</span></Link>
        {!!archived.length && <Link href={viewHref("archived")} aria-current={view === "archived" ? "page" : undefined}>Abandonnées <span>{archived.length}</span></Link>}
      </nav>
      {groups.length > 1 && <nav className={styles.projectNav} aria-label="Accéder à un projet">
        {groups.map(({ project }) => <a key={project} data-project={project} href={`#savings-${project}`}>{savingsProjects[project]}</a>)}
      </nav>}
      {view === "active" && hasNewTemplates && <form action={addSavingsTemplates}>
        <input type="hidden" name="returnMonth" value={month ?? ""} />
        <button className={styles.quiet}><Plus size={15} aria-hidden /> Ajouter les postes de départ</button>
      </form>}
    </div>
    {visible.length === 0 && <section className={styles.empty}>
      <Image src={projectArt[view === "active" ? "travel" : "other"]} width={84} height={70} alt="" />
      <h2>{view === "complete" ? "Aucun achat terminé" : view === "archived" ? "Aucune cagnotte abandonnée" : "Quels projets veux-tu financer ?"}</h2>
      <p>{view === "complete" ? "Indique « Achat terminé » sur une cagnotte une fois le dernier paiement effectué."
        : view === "active" && !goals.length ? "Ajoute les postes de départ pour les anniversaires, Noël et le voyage, ou crée ta première cagnotte." : null}</p>
    </section>}
    {groups.map(({ project, goals: projectGoals, season, seasons }) => {
      const ids = new Set(projectGoals.map(goal => goal.goalId));
      const cards = visible.filter(goal => ids.has(goal.goalId));
      const renderCard = (goal: SavingsGoal) =>
        <GoalCard key={goal.goalId} goal={goal} months={months} month={month} today={today} destinations={destinations} selected={params.goal === goal.goalId}
          reportId={typeof params.report === "string" ? params.report : undefined} />;
      return <section className={styles.group} data-project={project} key={project} aria-labelledby={`savings-${project}`}>
        <ProjectSummary project={project} goals={projectGoals} season={season} />
        {season && <div className={styles.seasonBar}>
          {seasons.length > 1 && <nav aria-label={`Années · ${savingsProjects[project]}`}>
            {seasons.map(value => <Link key={value} href={`${viewHref(view, value)}#savings-${project}`}
              aria-current={value === season ? "page" : undefined}>{value}</Link>)}
          </nav>}
          {season < 2099 && projectGoals.some(goal => !goal.abandoned) && <details>
            <summary>Dupliquer pour une autre année</summary>
            <form action={duplicateSavingsSeason} className={styles.form}>
              <input type="hidden" name="project" value={project} /><input type="hidden" name="fromSeason" value={season} />
              <input type="hidden" name="returnMonth" value={month ?? ""} />
              <label>Nouvelle année<input name="returnSeason" type="number" required min={season + 1} max={2099} defaultValue={season + 1} /></label>
              <p>Les postes et les destinataires sont repris. Les budgets restent à chiffrer.</p>
              <button className={styles.quiet}>Dupliquer les postes</button>
            </form>
          </details>}
        </div>}
        {project === "travel" ? <div className={styles.topics}>
          {savingsTravelTopicKeys.map(topic => {
            const topicGoals = projectGoals.filter(goal => (goal.travelTopic ?? "other") === topic);
            if (!topicGoals.length) return null;
            const topicCards = cards.filter(goal => (goal.travelTopic ?? "other") === topic);
            return <section className={styles.topic} key={topic} aria-labelledby={`voyage-${topic}`}>
              <TravelTopicSummary topic={topic} goals={topicGoals} />
              {topicCards.length > 0 && <div className={styles.cards}>{topicCards.map(renderCard)}</div>}
            </section>;
          })}
        </div> : cards.length > 0 && <div className={styles.cards}>{cards.map(renderCard)}</div>}
      </section>;
    })}
  </div>;
}

async function MonthBalance({ month, reserved }: { month: string; reserved: number }) {
  const { cents: balance, limits } = await readSavingsMargin(month);
  return <div className={styles.monthBalance}>
    <p><span>Réservé dans ce mois</span><strong>{savingsMoney(reserved)}</strong></p>
    <p data-negative={balance !== null && balance < 0}><span>Après dépenses et réservations</span>
      <strong>{balance === null ? "Marge à confirmer" : savingsMoney(balance)}</strong></p>
    {!!limits.length && <small>{limits.join(" · ")}</small>}
    {balance !== null && balance < 0 && <SavingsReportSuggestions key={month} month={month} />}
    <Link className={styles.textLink} href={composerHref(month)} prefetch={false}>Ouvrir le mois dans Composer <ArrowUpRight size={14} aria-hidden /></Link>
  </div>;
}

const monthChoices = (months: readonly string[]) => months.map(value => ({ value, label: monthLabel(value) }));

function GoalCard({ goal, months, month, today, selected, reportId, destinations }: {
  goal: SavingsGoal; months: readonly string[]; month?: string; today: string; selected: boolean; reportId?: string;
  destinations: { id: string; label: string }[];
}) {
  const progress = savingsGoalProgress(goal);
  const target = goal.targetCents ?? 0;
  const percent = savingsProgressPercent(progress.funded, target);
  const payableMonths = savingsFundingMonths(goal, months);
  const cutoff = savingsFundingDate(goal);
  const gap = savingsDeadlineGap(goal);
  const late = allocationsAfterCutoff(goal, cutoff);
  const allocations = effectiveSavingsAllocations(goal).sort((a, b) => a.month.localeCompare(b.month) || a.id.localeCompare(b.id));
  const Heading = goal.project === "travel" ? "h4" : "h3";
  const purchases = Object.entries(Object.groupBy(goal.purchases ?? [], purchase => purchase.operationId));
  return <article id={`cagnotte-${goal.goalId}`} className={styles.card} data-project={goal.project}>
    <div className={styles.cardIntro}>
      <Image src={goalArt(goal)} width={53} height={53} alt="" unoptimized />
      <div><Heading>{goal.label}</Heading>
        <p className={goal.deadline && goal.deadline < today && !progress.complete ? styles.warning : styles.muted}>
          {goal.deadline ? `Échéance · ${dateLabel(goal.deadline)}` : "Échéance à préciser"}</p>
        {goal.plannedPurchaseDate && <p className={styles.muted}>Achat prévu · {dateLabel(goal.plannedPurchaseDate)}</p>}
        {goal.recipient && <p className={styles.muted}>Pour {goal.recipient}</p>}
        {goal.optional && <span className={styles.priority}>Facultatif</span>}
        {(goal.priority ?? "normal") !== "normal" && <span className={styles.priority}>{savingsPriorities[goal.priority!]}</span>}</div>
    </div>
    <div className={styles.cardMoney}>
      <strong>{target || progress.funded ? savingsMoney(progress.funded) : "Objectif à chiffrer"}</strong>
      {!target && progress.funded > 0 && <span>financés · objectif à chiffrer</span>}
      {target > 0 && <><span>sur {savingsMoney(target)} · budget {savingsBudgetKinds[goal.budgetKind ?? "estimate"].toLowerCase()}</span>
        <span className={styles.percentChip}>{percent} % financés</span></>}
    </div>
    <FundingTrack budget={target} {...progress} label={`Financement · ${goal.label}`} />
    <p className={styles.purchaseState}>{goal.abandoned ? "Objectif abandonné" : progress.complete ? "Achat terminé"
      : progress.purchased > 0 ? "Achat en cours" : "À acheter"}</p>
    <p className={styles.footnote}>{savingsMoney(progress.purchased)} achetés · {savingsMoney(progress.saved)} disponibles sur le livret</p>
    {progress.exceeded > 0 && <p className={styles.warning}>{savingsMoney(progress.exceeded)} au-dessus du budget</p>}
    {!goal.abandoned && !progress.complete && progress.remaining !== null && <p className={styles.footnote}>
      {savingsMoney(progress.remaining)} à financer{progress.planned > 0 && ` · ${savingsMoney(progress.planned)} prévus`}
    </p>}
    {late > 0 && <p className={styles.warning}>{savingsMoney(late)} prévus après la date de financement.
      {gap !== null && gap > 0 && ` Il manque ${savingsMoney(gap)} avant cette date.`}</p>}
    <details open={selected || undefined} className={styles.details}>
      <summary>{target || goal.purchases?.length || goal.abandoned ? "Affectations et suivi" : "Configurer la cagnotte"} <ChevronDown size={15} aria-hidden /></summary>
      {purchases.length > 0 && <ul className={styles.purchaseLinks} aria-label="Achats liés">
        {purchases.map(([operationId, items]) => {
          const payment = items![0];
          return <li key={operationId} className={styles.linkedPayment}>
            <Link prefetch={false} href={purchaseHref(payment.date, operationId)}>
              {payment.label} <ArrowUpRight size={13} aria-hidden />
            </Link>
            <time dateTime={payment.date}>{dateLabel(payment.date)}</time>
            <ul>{items!.map(purchase => <li key={purchase.id}>
              <span>{purchase.article}{purchase.recipient && ` · ${purchase.recipient}`}</span>
              <strong>{savingsMoney(purchase.cents)}</strong>
              {purchase.refundedCents > 0 && <small>{savingsMoney(purchase.refundedCents)} remboursés sur {savingsMoney(purchase.grossCents)}</small>}
              {savingsLivretUsed(purchase) > 0 && <small>{savingsMoney(savingsLivretUsed(purchase))} utilisés sur le livret</small>}
            </li>)}</ul>
          </li>;
        })}
      </ul>}
      {!!goal.livretTransfers && <p className={styles.footnote}>
        {savingsMoney(Math.abs(goal.livretTransfers))} {goal.livretTransfers > 0 ? "reçus d’autres cagnottes" : "réaffectés à d’autres cagnottes"}
      </p>}
      {allocations.length > 0 && <div className={styles.allocations}>{allocations.map(row =>
        goal.abandoned ? <p key={row.id} className={styles.footnote}>{monthLabel(row.month)} · {row.status === "saved" ? "Versement au livret" : savingsStatuses[row.status]} · {savingsMoney(row.cents)}</p>
          : <Allocation key={row.id} goal={goal} row={row} months={payableMonths} currentMonth={month} showReport={reportId === row.id} />)}</div>}
      {(progress.unassigned ?? 0) > 0 && payableMonths.length > 0 && <SavingsFundingPlanner key={goal.revision}
        goalId={goal.goalId} revision={goal.revision} months={monthChoices(payableMonths)} selected={month} cutoff={cutoff ?? null}
        remaining={progress.unassigned!} />}
      {(progress.unassigned ?? 0) > 0 && !payableMonths.length && <p className={styles.warning}>Aucun mois ouvert avant l’échéance.</p>}
      {!goal.abandoned && (target > 0 ? <details className={styles.details}><summary>Modifier l’objectif <ChevronDown size={15} aria-hidden /></summary>
        <GoalForm goal={goal} month={month} year={Number(today.slice(0, 4))} /></details> : <GoalForm goal={goal} month={month} year={Number(today.slice(0, 4))} />)}
      <GoalLifecycle goal={goal} month={month} destinations={destinations.filter(item => item.id !== goal.goalId)} />
    </details>
  </article>;
}

function GoalLifecycle({ goal, month, destinations }: { goal: SavingsGoal; month?: string; destinations: { id: string; label: string }[] }) {
  const available = savingsGoalProgress(goal).saved;
  return <div className={styles.goalLifecycle}>
    {!goal.abandoned && <form action={setSavingsPurchaseComplete}>
      <GoalFields goal={goal} month={month} />
      <button type="submit" name="complete" value={goal.purchasedComplete ? "no" : "yes"} className={styles.quiet}>
        {goal.purchasedComplete ? "Rouvrir l’achat" : "Marquer l’achat terminé"}
      </button>
    </form>}
    {(!goal.abandoned || available > 0 && destinations.length > 0) && <details>
      <summary>{goal.abandoned ? "Réaffecter le solde du livret" : "Abandonner l’objectif"}</summary>
      <form action={abandonSavingsGoal} className={styles.form}>
        <GoalFields goal={goal} month={month} />
        <p>{goal.abandoned ? `${savingsMoney(available)} disponibles`
          : "Les réservations prévues seront libérées. Les achats restent visibles dans le projet."}</p>
        {available > 0 && destinations.length > 0 && <label>Réaffecter {savingsMoney(available)} à
          <select name="destinationId" required={goal.abandoned}>
            <option value="">{goal.abandoned ? "Choisir une cagnotte" : "Garder le solde sur cet objectif"}</option>
            {destinations.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>}
        <button className={styles.quiet}>{goal.abandoned ? "Réaffecter le solde" : "Confirmer l’abandon"}</button>
      </form>
    </details>}
  </div>;
}

function allocationsAfterCutoff(goal: SavingsGoal, cutoff: string | null | undefined) {
  if (!cutoff) return 0;
  return effectiveSavingsAllocations(goal).filter(row => row.status === "planned" && row.month > cutoff.slice(0, 7))
    .reduce((sum, row) => sum + row.cents, 0);
}

function Allocation({ goal, row, months, currentMonth, showReport }: {
  goal: SavingsGoal; row: SavingsGoalAllocation; months: readonly string[]; currentMonth?: string; showReport: boolean;
}) {
  const otherMonths = months.filter(month => month > row.month);
  return <details className={styles.allocation} id={`reservation-${row.id}`} open={showReport || undefined}>
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
    {row.status === "planned" && otherMonths.length > 0 && <SavingsPartialMove key={goal.revision} goalId={goal.goalId}
      revision={goal.revision} allocationId={row.id} months={monthChoices(otherMonths)} cents={row.cents} />}
    {row.status === "planned" && !otherMonths.length && <p className={styles.muted}>Aucun mois de report avant la date de financement.</p>}
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
    {goal && <><input type="hidden" name="goalId" value={goal.goalId} /><input type="hidden" name="revision" value={goal.revision} />
      {goal.season && <input type="hidden" name="returnSeason" value={goal.season} />}</>}</>;
}

function GoalForm({ goal, month, year }: { goal?: SavingsGoal; month?: string; year: number }) {
  return <form action={saveSavingsGoal} className={styles.form}>
    <GoalFields goal={goal} month={month} />
    <label>Nom de la cagnotte<input name="label" required maxLength={100} defaultValue={goal?.label} placeholder="Ex. cadeau de Noël pour…" /></label>
    <GoalProjectFields initialProject={goal?.project} initialTopic={goal?.travelTopic} initialSeason={goal?.season} year={year} />
    <label>Destinataire<input name="recipient" maxLength={80} defaultValue={goal?.recipient ?? ""} /></label>
    <label>Objectif en euros<input name="target" inputMode="decimal" defaultValue={goal?.targetCents == null ? "" : savingsEuros(goal.targetCents)} /></label>
    <label>Précision du budget<select name="budgetKind" defaultValue={goal?.budgetKind ?? "estimate"}>
      {Object.entries(savingsBudgetKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <label className={styles.check}><input type="checkbox" name="optional" defaultChecked={goal?.optional} /> Poste facultatif</label>
    <label>Date d’achat prévue<input name="plannedPurchaseDate" type="date" defaultValue={goal?.plannedPurchaseDate ?? ""} /></label>
    <label>Échéance finale<input name="deadline" type="date" defaultValue={goal?.deadline ?? ""} /></label>
    <label>Priorité<select name="priority" defaultValue={goal?.priority ?? "normal"}>
      {Object.entries(savingsPriorities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select></label>
    <button className={styles.primary}>{goal ? "Enregistrer l’objectif" : "Créer la cagnotte"}</button>
  </form>;
}

function MonthSelect({ months, selected }: { months: readonly string[]; selected?: string }) {
  return <select name="month" aria-label="Mois" defaultValue={selected && months.includes(selected) ? selected : months[0]}>
    {months.map(month => <option key={month} value={month}>{monthLabel(month)}</option>)}</select>;
}
