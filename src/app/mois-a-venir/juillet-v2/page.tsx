import Link from "next/link";
import { notFound } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { AppToolbarContent } from "@/components/layout/app-toolbar";
import { julyPilotLabels, type JulyPilotStatus } from "@/domain/phase2/planner/july-pilot";
import { JULY_COMPOSER_EDIT_HREF, JULY_COMPOSER_HREF, JULY_COMPOSER_MONTH, JULY_PILOT_DATE } from "@/domain/phase2/planner/realized-month-entry";
import { getBootstrapSession } from "@/server/bootstrap/context";
import type { CostRange } from "@/server/phase2/remaining-month-forecast";
import { plannerComposerEnabled } from "@/server/phase2/planner/cutover";
import type { readJulyBudget } from "@/server/phase2/planner/july-budget";
import { readJulyPlanning } from "@/server/phase2/planner/read-july-planning";
import { money, monthLabel, plannedDayLabel } from "../composer/display";
import { detailedRealizedCards } from "../composer/realized-card-view";
import { composerCalendarHref } from "../month-entry";
import { CalendarEventIcon } from "../month-calendar";
import { JulyEditLink } from "../composer/july-edit-link";
import { composerCalendarArtwork } from "../calendar-artwork";
import { ForecastOverview } from "../forecast-overview";
import { ForecastDashboard, ForecastLines, type ForecastModule } from "../forecast-dashboard";
import styles from "../forecast-dashboard.module.css";
import material from "../month-material.module.css";
import pilotStyles from "../composer/realized-month.module.css";
import composerStyles from "../composer/composer.module.css";

export const metadata = { title: "Prévisions de juillet 2026" };
export const dynamic = "force-dynamic";

export default async function JulyV2Page() {
  const { context, session } = await withProductAuthentication(getBootstrapSession);
  if (!context.household) notFound();
  const july = context.periods.find(period => period.month === `${JULY_COMPOSER_MONTH}-01`);
  const observed = july?.financeStatus === "complete" || july?.financeStatus === "partial";
  const composerEnabled = plannerComposerEnabled();
  const planning = observed ? await withProductAuthentication(() => readJulyPlanning(context, session.supabase)) : null;
  const { board, pilot, budget } = planning ?? {};
  const displayed = board?.cards.flatMap(detailedRealizedCards).map(({ card }) => card) ?? [];
  const pendingCount = displayed.filter(card => card.pilotStatus === "pending").length;
  const unpricedCards = !budget?.hasSavedDraft ? displayed.filter(card => card.pilotStatus === "planned" && card.amount === null).length : 0;
  const deadline = budget?.fixedCalendar.filter(item => item.status === "planned" && item.date && item.date > JULY_PILOT_DATE)
    .toSorted((a, b) => a.date!.localeCompare(b.date!))[0];

  return <div className={`${material.page} ${styles.workspace}`}>
    <h1 className="sr-only">Prévisions · Juillet 2026</h1>
    <AppToolbarContent className={composerStyles.compactToolbar}>
      <span className="text-xs font-semibold">Simulation au <time dateTime={JULY_PILOT_DATE}>15 juillet</time></span>
      <nav aria-label="Vues de Composer" className={composerStyles.reconstructionModes}>
        {board && <Link href={composerCalendarHref(JULY_COMPOSER_MONTH)} className={composerStyles.reconstructionLink}>Calendrier</Link>}
        {composerEnabled && board && <Link href={JULY_COMPOSER_HREF} className={composerStyles.reconstructionLink}>Au 15 juillet</Link>}
        {composerEnabled && <JulyEditLink className={composerStyles.reconstructionLink}>Édition</JulyEditLink>}
        <span className={composerStyles.reconstructionLink} aria-current="page">Prévisions</span>
      </nav>
    </AppToolbarContent>
    {budget && board && pilot ? <ForecastDashboard columns={julyModules(budget, pilot.cashAtCutoff, pilot.pendingExpenses, pendingCount, composerEnabled)} header={<ForecastOverview amount={budget.final.central}
        basis="Simulation au 15 juillet · marge sur les recettes hors transferts"
        deadline={deadline ? { ...deadline, date: deadline.date! } : undefined}
        calendarHref={composerCalendarHref(JULY_COMPOSER_MONTH)}
        decisions={pendingCount || unpricedCards ? [pendingCount ? `${pendingCount} à valider` : "", unpricedCards ? `${unpricedCards} à chiffrer` : ""].filter(Boolean).join(" · ") : "Aucun arbitrage signalé"}
        decisionAction={composerEnabled && (pendingCount > 0 || unpricedCards > 0) && <Link href={`${JULY_COMPOSER_HREF}&statut=${pendingCount ? "pending" : "planned"}`}>Ouvrir les cartes concernées</Link>} />} /> : <p className={`${material.glassSecondary} p-5`}>Les données de juillet ne sont pas disponibles pour cette simulation.</p>}
  </div>;
}

type JulyBudget = ReturnType<typeof readJulyBudget>;

function julyModules(budget: JulyBudget, cashAtCutoff: string | null, pendingExpenseAmount: string, pendingCount: number, composerEnabled: boolean): [ForecastModule[], ForecastModule[]] {
  const metric = (id: string, label: string, amount: string | null) => ({
    id, label, value: amount === null ? "À renseigner" : money(amount),
  });
  const expenseRows = (essential: boolean) => budget.rows.filter(row => row.essential === essential).map(row => ({
    ...metric(row.key, row.label, row.total.central),
    amount: row.total.central,
    note: row.balance ? "Estimation du mois entier" : "Montant renseigné",
    detail: <><VariableCard row={row} />
      {row.balance && <p>Fourchette fondée sur l’historique jusqu’en {monthLabel(budget.trainingThrough)}. Les cartes prévues couvrent d’abord une part de l’enveloppe.</p>}
    </>,
  }));
  return [[
    { id: "resources", title: "Entrées d’argent", icon: "overview", value: money(budget.confirmedIncome),
      rows: [
        { ...metric("received", "Encaissé au 15 juillet", budget.confirmedIncome),
          detail: <ForecastLines rows={budget.receipts.map(item => ({ id: item.id, label: item.label, value: money(item.amount),
            note: [julyPilotLabels[item.status], item.category, item.date && plannedDayLabel(item.date)].filter(Boolean).join(" · ") }))} /> },
        metric("expected", "Encore attendu", budget.plannedIncome),
        metric("bank", "Solde bancaire au 15 juillet", cashAtCutoff),
      ] },
    { id: "charges", title: "Charges fixes et échéances", icon: "expenses", value: money(budget.fixedTotal),
      rows: [
        metric("charged", "Déjà débité", budget.fixedConfirmed),
        metric("due", "À payer", budget.fixedPlanned),
        { id: "dates", label: "Échéances du mois", value: String(budget.fixedCalendar.length), detail: <BudgetDeadlines items={budget.fixedCalendar} /> },
      ] },
    { id: "minimum", title: "Minimum du mois", icon: "categories", value: money(budget.strictMinimum),
      rows: [
        metric("recorded", "Déjà débité au 15 juillet", budget.recordedExpenses),
        { ...metric("minimum", "Marge sur les recettes après le minimum", budget.afterMinimum),
          detail: <p>Le minimum réunit les débits observés, les échéances à venir et le bas des fourchettes du quotidien.</p> },
      ] },
  ], [
    { id: "essentials", title: "Dépenses du quotidien", icon: "groceries",
      rows: [...expenseRows(true), ...(budget.mobilityUsage ? [{
        id: "commute", label: "Trajets travail · Manon", value: money(budget.mobilityUsage.low) + " à " + money(budget.mobilityUsage.high),
        detail: <p>Estimation de l’essence consommée sur le mois. Les achats à la pompe figurent dans l’enveloppe Carburant.</p>,
      }] : [])] },
    { id: "extras", title: "Dépenses variables et extras", icon: "events",
      rows: [...expenseRows(false), ...((budget.planned.length || composerEnabled) ? [{
        id: "planned", label: "Cartes prévues", value: String(budget.planned.length),
        detail: <>
          <p>{budget.hasSavedDraft ? "Montants du brouillon enregistré." : "Montants issus des cartes reconstituées de juillet."}</p>
          <ForecastLines rows={budget.planned.map(item => ({ id: item.id, label: item.label, value: item.amount === null ? "À chiffrer" : money(item.amount),
            note: item.family + " · " + (item.date ? plannedDayLabel(item.date) : "À dater") }))} />
          {composerEnabled && <Link href={JULY_COMPOSER_EDIT_HREF} prefetch={false}>Ajuster dans Composer</Link>}
        </>,
      }] : [])] },
    { id: "projection", title: "Projection de fin de mois", icon: "overview", value: money(budget.final.central), note: "Marge sur les recettes hors transferts",
      rows: [
        { ...metric("total", "Dépenses totales", budget.totalExpenses.central), detail: <Range amounts={budget.totalExpenses} /> },
        { id: "scenarios", label: "Scénarios de fin de mois", value: money(budget.final.low) + " à " + money(budget.final.high),
          detail: <><Range amounts={budget.final} /><p>La marge se calcule sur les recettes du mois, hors transferts et paiements passés à vérifier.</p></> },
        ...(pendingCount ? [{ id: "pending", label: "Paiements à vérifier", value: String(pendingCount),
          detail: <><p>{pendingCount} cartes passées à valider. {Number(pendingExpenseAmount) !== 0 && `${money(pendingExpenseAmount.replace(/^-/, ""))} de paiements identifiés restent à confirmer.`}</p>
            {composerEnabled && <Link href={JULY_COMPOSER_HREF + "&statut=pending"} prefetch={false}>Voir les cartes à valider</Link>}</> }] : []),
      ] },
  ]];
}

function BudgetDeadlines({ items }: { items: JulyBudget["fixedCalendar"] }) {
  const chargeEntries = items.map(item => ({
    key: item.id, label: item.label, date: item.date, amount: item.amount, nature: "CERTAIN_OUTFLOW" as const,
    artwork: composerCalendarArtwork({ label: item.label + " " + item.family, art: item.artwork, badge: item.badge, category: item.category }),
    group: item.family, status: item.status,
    dateCertainty: item.status === "confirmed" ? "DECLARED" as const : "HISTORICAL_ESTIMATE" as const,
    fixedState: item.status === "confirmed" ? "OBSERVED" as const : "UPCOMING" as const,
  }));
  return <ol className="divide-y divide-violet-100">
      {chargeEntries.map(item => <li key={item.key} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 py-2.5 sm:grid-cols-[6rem_minmax(0,1fr)_7rem_7rem]">
        {item.date ? <time className="text-sm font-bold" dateTime={item.date}>{plannedDayLabel(item.date)}</time> : <span className="text-sm">À dater</span>}
        <div className="flex min-w-0 items-center gap-2 text-sm"><CalendarEventIcon item={item} size={30} />
          <div className="min-w-0"><strong>{item.label}</strong><span className="block text-xs text-slate-600">{item.group}</span></div>
        </div>
        <StateBadge status={item.status} />
        <strong className="col-start-2 text-sm sm:col-start-auto sm:text-right">{item.amount === null ? "À chiffrer" : money(item.amount)}</strong>
      </li>)}
    </ol>;
}

function VariableCard({ row }: { row: JulyBudget["rows"][number] }) {
  return <article className="min-w-0">
    {row.balance ? <Range amounts={row.total} /> : <p className="mt-1 text-base font-black">{money(row.total.central)} <span className="text-xs font-normal text-slate-600">renseignés</span></p>}
    <dl className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-xs">
      <div className="flex justify-between gap-2"><dt>Débité au 15</dt><dd className="font-bold">{money(row.recorded)}</dd></div>
      <div className="flex justify-between gap-2"><dt>Prévu dans Composer{row.plannedCount > 0 && ` · ${row.plannedCount} ${row.plannedCount === 1 ? "carte" : "cartes"}`}</dt><dd className="font-bold">{money(row.priced)}</dd></div>
      {row.balance && <div className="flex justify-between gap-2"><dt>Reste estimé après les cartes</dt><dd className="font-bold">{money(row.balance.central)}</dd></div>}
    </dl>
    {row.partialEstimate && <p className="mt-1 text-xs text-slate-600">Repère calculé sur les mois avec des pleins observés.</p>}
    {row.unpriced > 0 && <p className="mt-1 text-xs text-slate-600">{row.unpriced} {row.unpriced === 1 ? "montant à chiffrer" : "montants à chiffrer"}</p>}
  </article>;
}

function StateBadge({ status }: { status: JulyPilotStatus }) {
  return <span className={pilotStyles.pilotChip} data-pilot-chip={status}>{julyPilotLabels[status]}</span>;
}

function Range({ amounts }: { amounts: CostRange }) {
  const values = [["Basse", amounts.low], ["Centrale", amounts.central], ["Haute", amounts.high]] as const;
  return <dl className="mt-2 grid grid-cols-3 gap-2">
    {values.map(([label, amount]) => <div key={label}><dt className="text-xs text-slate-600">{label}</dt>
      <dd className={`${material.money} text-sm font-black tabular-nums`}>{money(amount)}</dd></div>)}
  </dl>;
}
