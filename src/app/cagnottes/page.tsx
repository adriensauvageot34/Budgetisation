import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowUpRight, CalendarClock, ChevronDown, CircleCheck, PiggyBank, Plus, ShoppingBag } from "lucide-react";
import { withProductAuthentication } from "@/app/product-query";
import { forecastWindowMonths } from "@/app/mois-a-venir/month-entry";
import { getBootstrapSession } from "@/server/bootstrap/context";
import { planningDate } from "@/server/phase2/planning-date";
import { readSavingsGoalSummaries, readSavingsProjectPurchases } from "@/server/phase2/savings-goals";
import type { BootstrapSession } from "@/server/bootstrap/auth";
import type { BootstrapHousehold, BootstrapHouseholdRevision, BootstrapPerson } from "@/server/bootstrap/types";
import { readSavingsMargin } from "@/server/phase2/savings-margin";
import { effectiveSavingsAllocations, savingsBudgetKinds, savingsEuros, savingsGoalProgress, savingsLivretUsed, savingsMoney, savingsPriorities, savingsProgressPercent, savingsProjects, savingsReconciledReservations, savingsStatuses, savingsTemplates, summarizeSavingsGoals,
  type SavingsGoal, type SavingsGoalAllocation, type SavingsStatus } from "@/domain/phase2/savings-goals";
import { savingsDeadlineGap, savingsFundingDate, savingsFundingMonths } from "@/domain/phase2/savings-schedule";
import { ARCHIVED_REALIZED_MONTHS, IMPORTED_REALIZED_MONTHS, JULY_COMPOSER_MONTH, JULY_PILOT_DATE, realizedComposerHref } from "@/domain/phase2/planner/realized-month-entry";
import { realizedOperationCardId } from "@/app/mois-a-venir/composer/realized-card-view";
import { abandonSavingsGoal, addSavingsTemplates, changeSavingsAllocation, duplicateSavingsSeason, saveSavingsGoal, setSavingsPurchaseComplete } from "./actions";
import { RealizedBadge } from "@/app/mois-a-venir/composer/realized-badge";
import { savingsRecipientKey, savingsRecipientPortraits, readSavingsPurchaseBadges } from "@/server/phase2/savings-purchase-badges";
import { SavingsDashboard } from "./savings-dashboard";
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
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const linkableMonths = [...ARCHIVED_REALIZED_MONTHS, JULY_COMPOSER_MONTH, ...IMPORTED_REALIZED_MONTHS].reverse();
const statusIcons = { planned: CalendarClock, saved: PiggyBank, purchased: ShoppingBag } satisfies Record<SavingsStatus, typeof CalendarClock>;
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
  const goals = await readSavingsGoalSummaries(session.supabase, context.household.householdId);
  const year = Number(today.slice(0, 4));
  const requestedSeason = typeof params.season === "string" && /^20\d{2}$/u.test(params.season) ? Number(params.season) : undefined;
  const selectedGoal = goals.find(goal => goal.goalId === params.goal);

  const filters = { all: "Tous les projets", unpriced: "À chiffrer", soon: "Échéance proche", complete: "Terminées", archived: "Abandonnées" };
  const view = typeof params.view === "string" && Object.hasOwn(filters, params.view) ? params.view as keyof typeof filters
    : selectedGoal?.abandoned ? "archived" : "all";
  const groups = savingsProjectKeys.flatMap(project => {
    const all = goals.filter(goal => goal.project === project);
    if (!all.length) return [];
    const seasons = [...new Set(all.flatMap(goal => goal.season ? [goal.season] : []))].sort((a, b) => b - a);
    const season = selectedGoal?.project === project && selectedGoal.season ? selectedGoal.season
      : requestedSeason && seasons.includes(requestedSeason) ? requestedSeason : seasons.includes(year) ? year : seasons[0];
    return [{ project, goals: all.filter(goal => !season || goal.season === season), season, seasons }];
  });
  const displayed = groups.flatMap(group => group.goals);

  const nextMonth = new Date(today);
  nextMonth.setUTCDate(nextMonth.getUTCDate() + 30);
  const horizon = nextMonth.toISOString().slice(0, 10);
  const openGoals = displayed.filter(goal => !goal.abandoned && !goal.purchasedComplete);
  const deadlines = openGoals.flatMap(goal => {
    const date = savingsFundingDate(goal);
    return date ? [{ goal, date }] : [];
  }).sort((a, b) => Number(a.date < today) - Number(b.date < today)
    || (a.date < today ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
    || a.goal.label.localeCompare(b.goal.label, "fr"));
  const near = deadlines.filter(({ date }) => date <= horizon);
  const outstanding = summarizeSavingsGoals(openGoals);
  const matches = {
    all: displayed.filter(goal => !goal.abandoned),
    unpriced: openGoals.filter(goal => goal.targetCents == null),
    soon: near.map(row => row.goal),
    complete: displayed.filter(goal => !goal.abandoned && goal.purchasedComplete),
    archived: displayed.filter(goal => goal.abandoned),
  };
  const allowed = new Set(matches[view].map(goal => goal.goalId));
  const viewHref = (next: string, season = requestedSeason, project?: string, goal?: string) => `/cagnottes?${new URLSearchParams({
    ...(month ? { month } : {}), ...(season ? { season: String(season) } : {}), view: next,
    ...(project ? { project } : {}), ...(goal ? { goal } : {}),
  })}`;
  const assigned = goals.flatMap(effectiveSavingsAllocations).filter(row => row.month === month && !row.accounted)
    .reduce((sum, row) => sum + row.cents, 0);
  const notice = typeof params.notice === "string" && Object.hasOwn(notices, params.notice) ? notices[params.notice] : undefined;
  const notification = notice && <p className={styles.notice} data-error={params.notice !== "saved"} role="status">{notice}</p>;
  const hasNewTemplates = savingsTemplates.some(template => !goals.some(goal => goal.templateKey === template.key));
  const destinations = goals.filter(goal => !goal.abandoned && !goal.purchasedComplete)
    .map(goal => ({ id: goal.goalId, label: [savingsProjects[goal.project], goal.season, goal.label].filter(Boolean).join(" · ") }));
  const initialProject = selectedGoal?.project ?? savingsProjectKeys.find(project => params.project === project);
  const reportId = typeof params.report === "string" ? params.report : undefined;
  const household = context.household;

  const projects = groups.map(({ project, goals: projectGoals, season, seasons }) => {
    const cards = projectGoals.filter(goal => allowed.has(goal.goalId) || selectedGoal === goal);
    const name = [savingsProjects[project], season].filter(Boolean).join(" ");
    return { id: project, name, href: viewHref(view, requestedSeason, project), preview: cards.length > 0
      ? <ProjectSummary project={project} goals={projectGoals} season={season} matching={view === "all" ? undefined : cards.length} /> : null,
      detail: initialProject === project ? <>
        {notification}
        <ProjectSummary project={project} goals={projectGoals} season={season} compact />
        {season && <div className={styles.seasonBar}>
          {seasons.length > 1 && <nav aria-label={`Années · ${savingsProjects[project]}`}>
            {seasons.map(value => <Link key={value} href={viewHref(view, value, project)}
              aria-current={value === season ? "page" : undefined}>{value}</Link>)}
          </nav>}
          {season < 2099 && projectGoals.some(goal => !goal.abandoned) && <details>
            <summary>Dupliquer pour une autre année</summary>
            <form action={duplicateSavingsSeason} className={styles.form}>
              <input type="hidden" name="project" value={project} /><input type="hidden" name="fromSeason" value={season} />
              <input type="hidden" name="returnProject" value={project} /><input type="hidden" name="returnMonth" value={month ?? ""} />
              <label>Nouvelle année<input name="returnSeason" type="number" required min={season + 1} max={2099} defaultValue={season + 1} /></label>
              <p>Les postes et les destinataires sont repris. Les budgets restent à chiffrer.</p>
              <button className={styles.quiet}>Dupliquer les postes</button>
            </form>
          </details>}
        </div>}
        {cards.length ? <Suspense fallback={<p className={styles.muted} role="status">Chargement des postes…</p>}>
          <SavingsProjectGoals session={session} household={household} revision={context.revision} people={context.persons} cards={cards} projectGoals={projectGoals}
            months={months} month={month} today={today} destinations={destinations} selectedId={selectedGoal?.goalId} reportId={reportId} />
        </Suspense> : <p className={styles.muted}>Aucun poste pour ce filtre.</p>}
      </> : null,
    };
  });

  return <div className={styles.workspace}>
    <header className={styles.hero}>
      <h1>Cagnottes</h1>
      <details className={styles.newGoal}>
        <summary className={styles.primary}><Plus size={17} aria-hidden /> Nouvelle cagnotte</summary>
        <GoalForm month={month} year={requestedSeason ?? year} />
      </details>
    </header>
    {!initialProject && notification}
    <SavingsDashboard key={JSON.stringify([month, view, requestedSeason])} listHref={viewHref(view)}
      initial={initialProject ? { project: initialProject, anchor: reportId ? `reservation-${reportId}`
        : selectedGoal ? `cagnotte-${selectedGoal.goalId}` : undefined } : undefined}
      projects={projects} deadlines={deadlines.slice(0, 3).map(({ goal, date }) => ({
        project: goal.project, id: goal.goalId, label: goal.label, date,
        when: date < today ? `${shortDate.format(new Date(date))} · En retard` : shortDate.format(new Date(date)),
        late: date < today,
        href: viewHref(view, requestedSeason, goal.project, goal.goalId),
      }))}
      overview={<section className={styles.monthPanel} aria-labelledby="savings-margin">
        <div className={styles.fundingLead}>
          <div><h2>Reste à financer</h2><strong data-budget-amount="lead">{outstanding.unpriced && !outstanding.budget ? "À chiffrer" : savingsMoney(outstanding.remaining)}</strong></div>
          {outstanding.unpriced > 0 && <span>{outstanding.unpriced} {outstanding.unpriced === 1 ? "poste à chiffrer" : "postes à chiffrer"}</span>}
        </div>
        <div className={styles.marginHeading}>
          <h2 id="savings-margin">Marge du mois</h2>
          {month && <form className={styles.monthSelector} action="/cagnottes">
            <input type="hidden" name="view" value={view} />
            {requestedSeason && <input type="hidden" name="season" value={requestedSeason} />}
            <MonthSelect months={months} selected={month} />
            <button className={styles.quiet}>Afficher la marge</button>
          </form>}
        </div>
        {month ? <Suspense key={month} fallback={<p className={styles.muted}>Calcul de la marge du mois…</p>}>
          <MonthBalance month={month} reserved={assigned} />
        </Suspense> : <p className={styles.muted}>Aucun mois de prévision disponible.</p>}
      </section>}
      filters={<div className={styles.listBar}>
        <nav aria-label="Filtrer les cagnottes" className={styles.tabs}>
          {(Object.keys(filters) as (keyof typeof filters)[]).map(key =>
            (key !== "archived" || matches.archived.length > 0) && <Link key={key} href={viewHref(key)} scroll={false} prefetch={false}
              aria-current={view === key ? "page" : undefined}>{filters[key]}{key !== "all" && <span>{matches[key].length}</span>}</Link>)}
        </nav>
        {view === "all" && hasNewTemplates && <form action={addSavingsTemplates}>
          <input type="hidden" name="returnMonth" value={month ?? ""} />
          <button className={styles.quiet}><Plus size={15} aria-hidden /> Ajouter les postes de départ</button>
        </form>}
      </div>}
      empty={<section className={styles.empty}>
        <Image src={projectArt[goals.length ? "other" : "travel"]} width={72} height={62} alt="" />
        <h2>{goals.length ? "Aucun poste pour ce filtre" : "Quels projets veux-tu financer ?"}</h2>
        {!goals.length && <p>Ajoute les postes de départ pour les anniversaires, Noël et le voyage, ou crée ta première cagnotte.</p>}
      </section>} />
  </div>;
}

async function SavingsProjectGoals({ session, household, revision, people, cards, projectGoals, months, month, today, destinations, selectedId, reportId }: {
  session: BootstrapSession; household: BootstrapHousehold; revision: BootstrapHouseholdRevision | null; people: readonly BootstrapPerson[];
  cards: SavingsGoal[]; projectGoals: SavingsGoal[]; months: readonly string[]; month?: string; today: string;
  destinations: { id: string; label: string }[]; selectedId?: string; reportId?: string;
}) {
  let purchases;
  try {
    purchases = await readSavingsProjectPurchases(session.supabase, household.householdId, session.user.id, cards, revision);
  } catch {
    return <p className={styles.warning} role="alert">Impossible de charger les postes. Ferme le projet et réessaie.</p>;
  }
  const byGoal = Object.groupBy(purchases, item => item.goalId);
  const recipients = savingsRecipientPortraits(household, people);
  const paymentBadges = readSavingsPurchaseBadges(session, household.householdId, purchases.map(item => item.operationId));
  const renderCard = (goal: SavingsGoal) => <GoalCard key={goal.goalId} goal={{ ...goal, purchases: byGoal[goal.goalId] ?? [] }}
    months={months} month={month} today={today} destinations={destinations} selected={selectedId === goal.goalId}
    reportId={reportId} recipients={recipients} paymentBadges={paymentBadges} />;
  if (cards[0]?.project !== "travel") return <div className={styles.cards}>{cards.map(renderCard)}</div>;
  return <div className={styles.topics}>{savingsTravelTopicKeys.map(topic => {
    const topicCards = cards.filter(goal => (goal.travelTopic ?? "other") === topic);
    if (!topicCards.length) return null;
    const topicGoals = projectGoals.filter(goal => (goal.travelTopic ?? "other") === topic);
    return <section className={styles.topic} key={topic} aria-labelledby={`voyage-${topic}`}>
      <TravelTopicSummary topic={topic} goals={topicGoals} />
      <div className={styles.cards}>{topicCards.map(renderCard)}</div>
    </section>;
  })}</div>;
}

async function MonthBalance({ month, reserved }: { month: string; reserved: number }) {
  const { cents: balance, limits } = await readSavingsMargin(month);
  return <div className={styles.monthBalance}>
    <p><span>Réservé dans ce mois</span><strong>{savingsMoney(reserved)}</strong></p>
    <p data-negative={balance !== null && balance < 0}><span>Après dépenses et réservations</span>
      <strong>{balance === null ? "Marge à confirmer" : savingsMoney(balance)}</strong></p>
    {!!limits.length && <details className={styles.marginLimits}><summary>Ce qui reste à confirmer</summary>
      <p>{limits.join(" · ")}</p></details>}
    {balance !== null && balance < 0 && <details className={styles.marginLimits}><summary>Voir les reports possibles</summary>
      <SavingsReportSuggestions key={month} month={month} /></details>}
    <Link className={styles.textLink} href={composerHref(month)} prefetch={false}>Ouvrir le mois dans Composer <ArrowUpRight size={14} aria-hidden /></Link>
  </div>;
}

const monthChoices = (months: readonly string[]) => months.map(value => ({ value, label: monthLabel(value) }));

function GoalCard({ goal, months, month, today, selected, reportId, destinations, recipients, paymentBadges }: {
  goal: SavingsGoal; months: readonly string[]; month?: string; today: string; selected: boolean; reportId?: string;
  destinations: { id: string; label: string }[];
  recipients: ReadonlyMap<string, string>; paymentBadges: Promise<ReadonlyMap<string, string[]>>;
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
  const hasPurchases = !!goal.purchases?.length;
  const reconciled = savingsReconciledReservations(goal);
  const canLink = !goal.abandoned && !progress.complete;
  const action = hasPurchases ? "Voir les achats" : goal.abandoned || progress.complete ? "Voir le suivi"
    : !target ? "Chiffrer" : (progress.unassigned ?? 0) > 0 && payableMonths.length > 0 ? "Planifier" : "Lier un achat";
  const purchaseStatus = goal.abandoned ? "Objectif abandonné" : progress.complete ? "Achat terminé"
    : progress.purchased > 0 ? "Acheté en partie" : "À acheter";
  const PurchaseIcon = progress.complete ? CircleCheck : progress.purchased > 0 ? ShoppingBag : CalendarClock;
  return <article id={`cagnotte-${goal.goalId}`} className={styles.card} data-project={goal.project} tabIndex={-1}>
    <div className={styles.cardIntro}>
      <Image src={goalArt(goal)} width={53} height={53} alt="" unoptimized />
      <div><Heading>{goal.label}</Heading>
        <p className={goal.deadline && goal.deadline < today && !progress.complete ? styles.warning : styles.muted}>
          {goal.deadline ? `Échéance · ${dateLabel(goal.deadline)}` : "Échéance à préciser"}</p>
        {goal.plannedPurchaseDate && <p className={styles.muted}>Achat prévu · {dateLabel(goal.plannedPurchaseDate)}</p>}
        {goal.recipient && <Recipient name={goal.recipient} portraits={recipients} />}
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
    <div className={styles.stateRow}>
      <span className={styles.purchaseState}><PurchaseIcon size={14} aria-hidden /> {purchaseStatus}</span>
      {progress.saved > 0 && <span className={styles.purchaseState} data-status="saved"><PiggyBank size={14} aria-hidden />
        {savingsMoney(progress.saved)} sur le livret</span>}
      {progress.planned > 0 && <span className={styles.purchaseState} data-status="planned"><CalendarClock size={14} aria-hidden />
        {savingsMoney(progress.planned)} prévus</span>}
    </div>
    {progress.purchased > 0 && <p className={styles.footnote}>{savingsMoney(progress.purchased)} achetés</p>}
    {progress.exceeded > 0 && <p className={styles.warning}>{savingsMoney(progress.exceeded)} au-dessus du budget</p>}
    {!goal.abandoned && !progress.complete && progress.remaining !== null && <p className={styles.footnote}>
      {savingsMoney(progress.remaining)} à financer
    </p>}
    {late > 0 && <p className={styles.warning}>{savingsMoney(late)} prévus après la date de financement.
      {gap !== null && gap > 0 && ` Il manque ${savingsMoney(gap)} avant cette date.`}</p>}
    <details open={selected || undefined} className={styles.details}>
      <summary><span className={styles.primary}>{action}</span>
        {hasPurchases && <span className={styles.footnote}>{goal.purchases!.length} {goal.purchases!.length === 1 ? "ligne d’achat" : "lignes d’achat"}</span>}
        <ChevronDown size={15} aria-hidden /></summary>
      {action === "Chiffrer" && <GoalForm goal={goal} month={month} year={Number(today.slice(0, 4))} />}
      {hasPurchases && <Suspense fallback={<PurchaseList goal={goal} portraits={recipients} />}>
        <PurchaseListWithBadges goal={goal} portraits={recipients} badges={paymentBadges} />
      </Suspense>}
      {reconciled.map(([matchingMonth, cents]) => <p key={matchingMonth} className={styles.footnote}>
        {monthLabel(matchingMonth)} · {savingsMoney(cents)} de réservation couverts par les achats liés du mois
      </p>)}
      {(progress.unassigned ?? 0) > 0 && payableMonths.length > 0 && <SavingsFundingPlanner key={goal.revision}
        goalId={goal.goalId} revision={goal.revision} months={monthChoices(payableMonths)} selected={month} cutoff={cutoff ?? null}
        remaining={progress.unassigned!} />}
      {(progress.unassigned ?? 0) > 0 && !payableMonths.length && <p className={styles.warning}>Aucun mois ouvert avant l’échéance.</p>}
      {canLink && (action === "Lier un achat" ? <LinkPurchaseForm goal={goal} />
        : <details className={styles.linkPurchase}><summary>Lier un achat</summary><LinkPurchaseForm goal={goal} /></details>)}
      {!!goal.livretTransfers && <p className={styles.footnote}>
        {savingsMoney(Math.abs(goal.livretTransfers))} {goal.livretTransfers > 0 ? "reçus d’autres cagnottes" : "réaffectés à d’autres cagnottes"}
      </p>}
      {allocations.length > 0 && <div className={styles.allocations}>{allocations.map(row =>
        goal.abandoned ? <p key={row.id} className={styles.footnote}>{monthLabel(row.month)} · {row.status === "saved" ? "Versement au livret" : savingsStatuses[row.status]} · {savingsMoney(row.cents)}</p>
          : <Allocation key={row.id} goal={goal} row={row} months={payableMonths} currentMonth={month} showReport={reportId === row.id} />)}</div>}
      {!goal.abandoned && action !== "Chiffrer" && <details className={styles.details}><summary>Modifier l’objectif <ChevronDown size={15} aria-hidden /></summary>
        <GoalForm goal={goal} month={month} year={Number(today.slice(0, 4))} /></details>}
      <GoalLifecycle goal={goal} month={month} destinations={destinations.filter(item => item.id !== goal.goalId)} />
    </details>
  </article>;
}

function Recipient({ name, portraits }: { name: string; portraits: ReadonlyMap<string, string> }) {
  const src = portraits.get(savingsRecipientKey(name));
  return <span className={styles.recipient}>
    {src && <img src={src} alt="" width={22} height={22} loading="lazy" />}
    {savingsRecipientKey(name) === "couple" ? name : `Pour ${name}`}
  </span>;
}

function LinkPurchaseForm({ goal }: { goal: SavingsGoal }) {
  const preferred = savingsFundingDate(goal)?.slice(0, 7);
  return <form action="/mois-a-venir/composer" className={styles.linkPurchaseForm}>
    <input type="hidden" name="cagnotte" value={goal.goalId} />
    <MonthSelect months={linkableMonths} selected={preferred} />
    <button className={styles.quiet}>Choisir une dépense <ArrowUpRight size={14} aria-hidden /></button>
  </form>;
}

async function PurchaseListWithBadges({ goal, portraits, badges }: {
  goal: SavingsGoal; portraits: ReadonlyMap<string, string>; badges: Promise<ReadonlyMap<string, string[]>>;
}) {
  return <PurchaseList goal={goal} portraits={portraits} badges={await badges} />;
}

function PurchaseList({ goal, portraits, badges }: {
  goal: SavingsGoal; portraits: ReadonlyMap<string, string>; badges?: ReadonlyMap<string, string[]>;
}) {
  const purchases = Object.entries(Object.groupBy(goal.purchases ?? [], purchase => purchase.operationId));
  return <ul className={styles.purchaseLinks} aria-label="Achats liés">
    {purchases.map(([id, items]) => {
      const payment = items?.[0];
      if (!payment) return null;
      const sources = badges?.get(id);
      return <li key={id} className={styles.linkedPayment}>
        <Link prefetch={false} href={purchaseHref(payment.date, id)} className={styles.paymentLink}>
          {sources && <RealizedBadge label={payment.label} sources={sources} />}
          {payment.label} <ArrowUpRight size={13} aria-hidden />
        </Link>
        <time dateTime={payment.date}>{dateLabel(payment.date)}</time>
        <ul>{items.map(purchase => <li key={purchase.id}>
          <span>{purchase.article}</span>
          <strong>{savingsMoney(purchase.cents)}</strong>
          {purchase.recipient && <Recipient name={purchase.recipient} portraits={portraits} />}
          {purchase.refundedCents > 0 && <small>{savingsMoney(purchase.refundedCents)} remboursés sur {savingsMoney(purchase.grossCents)}</small>}
          {savingsLivretUsed(purchase) > 0 && <small>{savingsMoney(savingsLivretUsed(purchase))} utilisés sur le livret</small>}
        </li>)}</ul>
      </li>;
    })}
  </ul>;
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
  const StatusIcon = statusIcons[row.status];
  return <details className={styles.allocation} id={`reservation-${row.id}`} open={showReport || undefined}>
    <summary><span>{monthLabel(row.month)} <small data-status={row.status}><StatusIcon size={12} aria-hidden /> {savingsStatuses[row.status]}</small></span>
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
