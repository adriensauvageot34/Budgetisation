import Link from "next/link";
import { notFound } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { parseYearMonth } from "@/core/time";
import { julyPilotLabels, type JulyPilotStatus } from "@/domain/phase2/planner/july-pilot";
import { JULY_COMPOSER_EDIT_HREF, JULY_COMPOSER_FULL_HREF, JULY_COMPOSER_HREF, JULY_COMPOSER_MONTH, JULY_PILOT_DATE } from "@/domain/phase2/planner/realized-month-entry";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { resolveRealBankBalance } from "@/server/phase2/bank-cash-projection";
import { readMonthPredictionEvidence } from "@/server/phase2/month-prediction-evidence";
import type { CostRange } from "@/server/phase2/remaining-month-forecast";
import { readActiveComposerDraft } from "@/server/phase2/planner/composer-draft-service";
import { composerDraftAutosaveEnabledFor } from "@/server/phase2/planner/composer-draft-cutover";
import { plannerComposerEnabled } from "@/server/phase2/planner/cutover";
import { readJulyBudget } from "@/server/phase2/planner/july-budget";
import { julyPilotForecast, projectJulyPilot } from "@/server/phase2/planner/july-pilot";
import { readMonthComposer } from "@/server/phase2/planner/read-model";
import { readRealizedMonth } from "@/server/phase2/planner/realized-month";
import { authorizedPlanner } from "@/server/phase2/planner/runtime";
import { money, monthLabel, plannedDayLabel } from "../composer/display";
import { detailedRealizedCards } from "../composer/realized-card-view";
import { CalendarEventIcon, MonthCalendar } from "../month-calendar";
import type { CalendarArtwork } from "../calendar-metadata";
import { clayAssetArtwork, clayBuilderArtwork, clayContextArtwork, clayV22Artwork } from "../clay-v22-media";
import type { CalendarEntry } from "../planned-expenses-projection";
import material from "../month-material.module.css";
import pilotStyles from "../composer/realized-month.module.css";

export const metadata = { title: "Juillet V2" };
export const dynamic = "force-dynamic";
const button = `${material.clayButton} inline-flex items-center px-4 py-2 text-sm font-bold`;

async function savedJulyComposer() {
  const planner = await authorizedPlanner();
  const draft = await readActiveComposerDraft(planner, JULY_COMPOSER_MONTH);
  if (!draft) return null;
  const { deps, householdId } = planner;
  return readMonthComposer({ ...deps, readWorld: deps.readComposerWorld ?? deps.readWorld },
    householdId, JULY_COMPOSER_MONTH, draft.semanticState);
}

export default async function JulyV2Page() {
  const context = await withProductAuthentication(() => getBootstrapContext());
  if (!context.household) notFound();
  const { householdId, timezone } = context.household;
  const july = context.periods.find(period => period.month === `${JULY_COMPOSER_MONTH}-01`);
  const observed = july?.financeStatus === "complete" || july?.financeStatus === "partial";
  const composerEnabled = plannerComposerEnabled();
  const [source, evidence, draft] = observed ? await Promise.all([
    readRealizedMonth(context, parseYearMonth(JULY_COMPOSER_MONTH)),
    readMonthPredictionEvidence(createCanonicalReadClient(), householdId, JULY_COMPOSER_MONTH, true,
      { asOfDate: JULY_PILOT_DATE, timezone }),
    composerEnabled && composerDraftAutosaveEnabledFor(context.user.id) ? withProductAuthentication(savedJulyComposer) : null,
  ]) : [null, null, null];
  const board = source ? projectJulyPilot(source) : null;
  const balance = evidence && resolveRealBankBalance({
    observation: evidence.manualBankBalanceObservation ?? null, today: JULY_PILOT_DATE,
    bank: evidence.bankObservations ?? [], intervals: evidence.bankCoverageIntervals,
  });
  const pilot = board ? julyPilotForecast(board, balance?.amount ?? null) : null;
  const budget = source && board && evidence ? readJulyBudget(source, board, evidence, draft) : null;
  const displayed = board?.cards.flatMap(detailedRealizedCards).map(({ card }) => card) ?? [];
  const pendingCount = displayed.filter(card => card.pilotStatus === "pending").length;
  const unpricedCards = !draft ? displayed.filter(card => card.pilotStatus === "planned" && card.amount === null).length : 0;

  return <div className={`${material.page} mx-auto max-w-6xl space-y-5`}>
    <header className={`${material.glassPremium} ${material.glassHero} px-6 py-5 sm:px-8`}>
      <p className="eyebrow">Simulation · <time dateTime={JULY_PILOT_DATE}>15 juillet 2026</time></p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Juillet V2</h1>
        <nav aria-label="Accès du mois de juillet" className="flex flex-wrap gap-2">
          {composerEnabled && board && <Link href={JULY_COMPOSER_HREF} prefetch={false} className={`${material.clayPrimary} inline-flex items-center px-4 py-2 text-sm font-bold`}>Voir les cartes</Link>}
          {composerEnabled && <Link href={JULY_COMPOSER_EDIT_HREF} prefetch={false} className={button}>Éditer le brouillon</Link>}
          {board && <Link href={composerEnabled ? JULY_COMPOSER_FULL_HREF : `/historique/${JULY_COMPOSER_MONTH}`} prefetch={false} className={button}>Bilan complet</Link>}
        </nav>
      </div>
    </header>
    {budget && board && pilot ? <>
      <section className={`${material.glassPremium} p-5 sm:p-6`} aria-labelledby="july-income">
        <h2 id="july-income" className="text-xl font-black">Entrées d’argent</h2>
        <Metrics values={[
          ["Encaissé au 15 juillet", budget.confirmedIncome], ["Encore attendu", budget.plannedIncome],
          ["Solde bancaire au 15 juillet", pilot.cashAtCutoff],
        ]} />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {budget.receipts.map(item => <div key={item.id} className={`${material.resourceCard} flex flex-wrap items-center justify-between gap-2 p-3`}>
            <div><strong className="text-sm">{item.label}</strong>
              <p className="text-xs text-slate-600">{[item.category, plannedDayLabel(item.date)].filter(Boolean).join(" · ")}</p></div>
            <div className="flex flex-wrap items-center gap-2"><StateBadge status={item.status} /><strong>{money(item.amount)}</strong></div>
          </div>)}
        </div>
      </section>
      <section className={`${material.glassSecondary} p-5 sm:p-6`} aria-labelledby="july-fixed">
        <h2 id="july-fixed" className="text-xl font-black">Charges fixes et échéances</h2>
        <Metrics values={[
          ["Déjà débité", budget.fixedConfirmed], ["À payer", budget.fixedPlanned], ["Total renseigné", budget.fixedTotal],
        ]} />
        <BudgetCalendar items={budget.fixedCalendar} projects={budget.plannedCalendar} dailyTotals={budget.dailyCalendarTotals} />
      </section>
      <section className={`${material.glassSoft} p-5 sm:p-6`} aria-labelledby="july-essentials">
        <h2 id="july-essentials" className="text-xl font-black">Variables du quotidien</h2>
        <p className="mt-1 text-sm text-slate-600">Fourchettes pour le mois entier, estimées à partir de l’historique jusqu’en {monthLabel(budget.trainingThrough)}. Les cartes prévues couvrent d’abord ce que l’enveloppe prévoit déjà.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {budget.rows.filter(row => row.essential).map(row => <VariableCard key={row.key} row={row} />)}
        </div>
        {budget.mobilityUsage && <p className="mt-3 text-xs text-slate-600">Trajets travail de Manon · usage d’essence estimé entre {money(budget.mobilityUsage.low)} et {money(budget.mobilityUsage.high)} sur le mois. Les achats à la pompe figurent dans l’enveloppe Carburant.</p>}
      </section>
      <section className={`${material.glassPremium} ${material.glassQuiet} p-5 sm:p-6`} aria-labelledby="july-minimum">
        <h2 id="july-minimum" className="text-xl font-black">Minimum du mois</h2>
        <p className="mt-1 text-sm text-slate-600">Ce qui est déjà débité, les échéances à venir et le bas des fourchettes du quotidien. Les sorties et achats optionnels encore à venir sont détaillés ensuite.</p>
        <Metrics values={[
          ["Déjà débité au 15 juillet", budget.recordedExpenses], ["Dépenses minimales estimées", budget.strictMinimum],
          ["Marge sur les recettes après le minimum", budget.afterMinimum],
        ]} />
      </section>
      <section className={`${material.glassSoft} p-5 sm:p-6`} aria-labelledby="july-extras">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="july-extras" className="text-xl font-black">Dépenses variables et extras</h2>
          {composerEnabled && <Link href={JULY_COMPOSER_EDIT_HREF} prefetch={false} className={button}>Ajuster dans Composer</Link>}
        </div>
        <p className="mt-1 text-sm text-slate-600">{budget.hasSavedDraft ? "Montants synchronisés avec le brouillon enregistré." : "Montants proposés par les cartes reconstituées de juillet."}</p>
        {composerEnabled && unpricedCards > 0 && <Link href={`${JULY_COMPOSER_HREF}&statut=planned`} prefetch={false} className="mt-1 inline-block text-sm underline">{unpricedCards} cartes prévues avec un montant à renseigner</Link>}
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {budget.rows.filter(row => !row.essential).map(row => <VariableCard key={row.key} row={row} />)}
        </div>
        {budget.planned.length > 0 && <details className="mt-4 rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-bold">Détail des montants des cartes prévues</summary>
          <ul className="mt-2 divide-y divide-slate-200 text-sm">
            {budget.planned.map(line => <li key={line.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2">
              <div><strong>{line.label}</strong><p className="text-xs text-slate-600">{line.family} · {line.date ? plannedDayLabel(line.date) : "À dater"}</p></div>
              <strong>{line.amount === null ? "À chiffrer" : money(line.amount)}</strong>
            </li>)}
          </ul>
        </details>}
      </section>
      {pendingCount > 0 && <section className={`${material.glassSecondary} p-5 sm:p-6`} aria-labelledby="july-pending">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="july-pending" className="text-xl font-black">À vérifier au 15 juillet</h2>
          {composerEnabled && <Link href={`${JULY_COMPOSER_HREF}&statut=pending`} prefetch={false} className={button}>Voir les cartes à valider</Link>}
        </div>
        <p className="mt-1 text-sm text-slate-600">{pendingCount} cartes passées à valider. {Number(pilot.pendingExpenses) !== 0 && `${money(pilot.pendingExpenses.replace(/^-/, ""))} de paiements identifiés restent à confirmer.`}</p>
      </section>}
      <section className={`${material.glassPremium} p-5 sm:p-6`} aria-labelledby="july-end">
        <h2 id="july-end" className="text-xl font-black">Projection de fin de mois</h2>
        <p className="mt-1 text-sm text-slate-600">Budget sur les montants connus et les habitudes estimées. La marge se calcule sur les recettes de juillet, hors transferts et paiements passés à vérifier.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className={`${material.centralScenario} p-3`}><h3 className="text-sm font-bold">Dépenses totales</h3><Range amounts={budget.totalExpenses} /></div>
          <div className={`${material.centralScenario} p-3`}><h3 className="text-sm font-bold">Marge sur les recettes de juillet</h3><Range amounts={budget.final} /></div>
        </div>
      </section>
    </> : <p className={`${material.glassSecondary} p-5`}>Les données de juillet ne sont pas disponibles pour cette simulation.</p>}
  </div>;
}

type JulyBudget = ReturnType<typeof readJulyBudget>;

function julyCalendarArtwork(item: JulyBudget["fixedCalendar"][number] | JulyBudget["plannedCalendar"][number]): CalendarArtwork {
  if ("badge" in item) {
    const badge = item.badge?.sources.find(src => src.startsWith("/"));
    if (badge) return { src: badge, kind: "badge" };
  }
  const merchandise = "/planned-visuals/commerce/categories";
  const label = "family" in item ? `${item.label} ${item.family}` : item.label;
  if (item.category === "groceries") return { src: `${merchandise}/groceries.webp`, kind: "badge" };
  if (/mini[- ]golf|\bgolfy\b/iu.test(label)) return { src: `${merchandise}/mini-golf.webp`, kind: "badge" };
  const categoryAssets: Readonly<Record<string, string>> = {
    fuel: "transport:fuel_usage", "adrien-work-coffee": "scene:coffee",
    "adrien-work-meals": "scene:work_meal", "manon-work-meals": "scene:work_meal",
  };
  const categoryArt = clayAssetArtwork(categoryAssets[item.category])?.src;
  const specific = /cano[eëé]|kayak/iu.test(label) ? clayV22Artwork("v22-art:extra:kayak-activity")?.src
    : /titres?[- ]restau|carte ticket restaurant/iu.test(label) ? `${merchandise}/tickets.webp` : undefined;
  const commerce = item.category === "tobacco-vape" ? `${merchandise}/tobacco.webp`
    : item.category === "fixed" && /r[ée]gie|\beau\b/iu.test(label) ? `${merchandise}/public-services.webp` : undefined;
  const { artwork } = item;
  const src = specific ?? categoryArt ?? commerce ?? artwork.src ?? clayAssetArtwork(artwork.assetKey)?.src
    ?? (artwork.assetKey ? clayBuilderArtwork(artwork.assetKey, "compact")?.src : undefined)
    ?? clayContextArtwork(artwork.templateKey)?.src ?? clayContextArtwork("activity")!.src;
  return { src, kind: "clay" };
}

function BudgetCalendar({ items, projects, dailyTotals }: {
  items: JulyBudget["fixedCalendar"]; projects: JulyBudget["plannedCalendar"]; dailyTotals: JulyBudget["dailyCalendarTotals"];
}) {
  const chargeEntries = items.map(item => ({
    key: item.id, label: item.label, date: item.date, amount: item.amount, nature: "CERTAIN_OUTFLOW" as const,
    artwork: julyCalendarArtwork(item),
    group: item.family, status: item.status,
    dateCertainty: item.status === "confirmed" ? "DECLARED" as const : "HISTORICAL_ESTIMATE" as const,
    fixedState: item.status === "confirmed" ? "OBSERVED" as const : "UPCOMING" as const,
  }));
  const charges: CalendarEntry[] = chargeEntries.flatMap(item => item.date ? [{ ...item, date: item.date }] : []);
  const projectEntries: CalendarEntry[] = projects.map(project => ({
    key: project.id, label: project.label, date: project.date, amount: project.amount, nature: "PLANNED_EXPENSE", dateCertainty: "DECLARED",
    artwork: julyCalendarArtwork(project),
  }));
  return <div className="mt-4">
    <MonthCalendar targetMonth={JULY_COMPOSER_MONTH} entries={[...charges, ...projectEntries]} undated={[]} dailyTotals={dailyTotals} today={JULY_PILOT_DATE} compactArtwork />
    <details className="mt-3 rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-bold">Toutes les échéances du mois</summary>
      <ol className="mt-2 divide-y divide-slate-200">
        {chargeEntries.map(item => <li key={item.key} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 py-2.5 sm:grid-cols-[6rem_minmax(0,1fr)_7rem_7rem]">
          {item.date ? <time className="text-sm font-bold" dateTime={item.date}>{plannedDayLabel(item.date)}</time> : <span className="text-sm">À dater</span>}
          <div className="flex min-w-0 items-center gap-2 text-sm"><CalendarEventIcon item={item} size={30} />
            <div className="min-w-0"><strong>{item.label}</strong><span className="block text-xs text-slate-600">{item.group}</span></div>
          </div>
          <StateBadge status={item.status} />
          <strong className="col-start-2 text-sm sm:col-start-auto sm:text-right">{item.amount === null ? "À chiffrer" : money(item.amount)}</strong>
        </li>)}
      </ol>
    </details>
  </div>;
}

function VariableCard({ row }: { row: JulyBudget["rows"][number] }) {
  return <article className={`${material.centralScenario} p-3`}>
    <h3 className="font-bold">{row.label}</h3>
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

function Metrics({ values }: { values: readonly (readonly [string, string | null])[] }) {
  return <dl className="mt-3 grid gap-2 sm:grid-cols-3">
    {values.map(([label, amount]) => <div key={label} className={`${material.centralScenario} px-3 py-2`}>
      <dt className="text-xs font-bold">{label}</dt>
      <dd className={`${material.money} mt-1 text-base font-black`}>{amount === null ? "À renseigner" : money(amount)}</dd>
    </div>)}
  </dl>;
}
