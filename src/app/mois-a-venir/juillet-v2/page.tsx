import Link from "next/link";
import { notFound } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { parseYearMonth } from "@/core/time";
import { julyPilotLabels } from "@/domain/phase2/planner/july-pilot";
import { JULY_COMPOSER_EDIT_HREF, JULY_COMPOSER_FULL_HREF, JULY_COMPOSER_HREF, JULY_COMPOSER_MONTH, JULY_PILOT_DATE } from "@/domain/phase2/planner/realized-month-entry";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { createCanonicalReadClient } from "@/server/canonical/client";
import { resolveRealBankBalance } from "@/server/phase2/bank-cash-projection";
import { readMonthPredictionEvidence } from "@/server/phase2/month-prediction-evidence";
import { plannerComposerEnabled } from "@/server/phase2/planner/cutover";
import { julyPilotForecast, projectJulyPilot } from "@/server/phase2/planner/july-pilot";
import { readRealizedMonth } from "@/server/phase2/planner/realized-month";
import { money, plannedDayLabel } from "../composer/display";
import material from "../month-material.module.css";
import pilotStyles from "../composer/realized-month.module.css";

export const metadata = { title: "Juillet V2" };

export default async function JulyV2Page() {
  const context = await withProductAuthentication(() => getBootstrapContext());
  if (!context.household) notFound();
  const { householdId, timezone } = context.household;
  const july = context.periods.find(period => period.month === `${JULY_COMPOSER_MONTH}-01`);
  const observed = july?.financeStatus === "complete" || july?.financeStatus === "partial";
  const composerEnabled = plannerComposerEnabled();
  const historicalHref = `/historique/${JULY_COMPOSER_MONTH}`;
  const [board, evidence] = observed ? await Promise.all([
    readRealizedMonth(context, parseYearMonth(JULY_COMPOSER_MONTH)).then(projectJulyPilot),
    readMonthPredictionEvidence(createCanonicalReadClient(), householdId, JULY_COMPOSER_MONTH, true,
      { asOfDate: JULY_PILOT_DATE, timezone }),
  ]) : [null, null];
  const balance = evidence && resolveRealBankBalance({
    observation: evidence.manualBankBalanceObservation ?? null, today: JULY_PILOT_DATE,
    bank: evidence.bankObservations ?? [], intervals: evidence.bankCoverageIntervals,
  });
  const forecast = board ? julyPilotForecast(board, balance?.amount ?? null) : null;
  const button = `${material.clayButton} inline-flex items-center px-4 py-2.5 text-sm font-bold`;

  return <div className={`${material.page} mx-auto max-w-6xl space-y-5`}>
    <header className={`${material.glassPremium} ${material.glassHero} p-6 sm:p-9`}>
      <p className="eyebrow">Simulation · <time dateTime={JULY_PILOT_DATE}>15 juillet 2026</time></p>
      <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Juillet V2</h1>
      <p className="mt-3 max-w-xl text-sm text-slate-600">Les paiements confirmés s’arrêtent au 15 juillet inclus. Les montants du 16 au 31 servent de budget pour la suite du mois.</p>
      <nav aria-label="Accès du mois de juillet" className="mt-6 flex flex-wrap gap-3">
        {composerEnabled && board && <Link href={JULY_COMPOSER_HREF} prefetch={false} className={`${material.clayPrimary} inline-flex items-center px-4 py-2.5 text-sm font-bold`}>Voir les cartes</Link>}
        {composerEnabled && <Link href={JULY_COMPOSER_EDIT_HREF} prefetch={false} className={button}>Éditer le brouillon</Link>}
        {board && <Link href={composerEnabled ? JULY_COMPOSER_FULL_HREF : historicalHref} prefetch={false} className={button}>Bilan complet</Link>}
      </nav>
    </header>
    {board && forecast ? <>
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Prévisions de juillet">
        <div className={`${material.glassSecondary} p-5 sm:p-6`}>
          <span className={pilotStyles.pilotChip} data-pilot-chip="confirmed">Validé</span>
          <h2 className="mt-2 text-xl font-black">Du 1er au 15 juillet</h2>
          <p className="mt-1 text-sm text-slate-600">{board.operationCount} opérations confirmées{july?.financeStatus === "partial" && " · couverture partielle"}</p>
          <Metrics values={[
            ["Revenus encaissés", board.totals.income.amount], ["Remboursements reçus", board.totals.refund.amount],
            ["Charges fixes débitées", forecast.confirmedFixed], ["Dépenses variables débitées", forecast.confirmedVariable],
            ["Net hors transferts", board.net], ["Solde bancaire au 15", forecast.cashAtCutoff],
          ]} />
        </div>
        <div className={`${material.glassSecondary} p-5 sm:p-6`}>
          <span className={pilotStyles.pilotChip} data-pilot-chip="planned">Prévu</span>
          <h2 className="mt-2 text-xl font-black">Du 16 au 31 juillet</h2>
          <p className="mt-1 text-sm text-slate-600">{forecast.plannedCount} cartes prévues{forecast.unpricedCount > 0 && ` · ${forecast.unpricedCount} sans montant`}</p>
          <Metrics values={[
            ["Encaissements attendus", forecast.plannedIncome], ["Charges fixes restantes", forecast.plannedFixed],
            ["Budget variable renseigné", forecast.plannedVariable], ["Net projeté de juillet", forecast.projectedNet],
            ["Solde bancaire projeté au 31", forecast.projectedCash],
          ]} />
          <p className="mt-3 text-xs text-slate-600">La projection inclut les montants renseignés hors transferts. Le solde bancaire dépend d’un pointage daté et disponible au 15 juillet.</p>
        </div>
      </section>
      <section className={`${material.glassSecondary} p-5 sm:p-6`} aria-labelledby="july-pending">
        <span className={pilotStyles.pilotChip} data-pilot-chip="pending">Passé · à valider</span>
        <h2 id="july-pending" className="mt-2 text-xl font-black">Ce qu’il reste à confirmer</h2>
        <p className="mt-1 text-sm text-slate-600">{forecast.pendingCount} {forecast.pendingCount === 1 ? "carte passée à vérifier" : "cartes passées à vérifier"}.
          {Number(forecast.pendingExpenses) !== 0 ? ` Montants connus à confirmer ${money(forecast.pendingExpenses)}. ` : " "}
          Leurs montants restent en dehors du net projeté tant que le paiement est à confirmer.</p>
      </section>
      <section className={`${material.glassSecondary} p-5 sm:p-6`} aria-labelledby="july-fixed">
        <h2 id="july-fixed" className="text-xl font-black">Calendrier des charges fixes</h2>
        <ol className="mt-4 divide-y divide-slate-200">
          {forecast.fixedCalendar.map(item => <li key={item.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-2 py-2.5 sm:grid-cols-[6rem_minmax(0,1fr)_7rem_7rem]">
            <time className="text-sm font-bold" dateTime={item.date}>{plannedDayLabel(item.date)}</time>
            <div className="min-w-0 text-sm"><strong>{item.label}</strong><span className="block text-xs text-slate-600">{item.family}</span></div>
            <span className={pilotStyles.pilotChip} data-pilot-chip={item.status}>{julyPilotLabels[item.status]}</span>
            <strong className="col-start-2 text-sm sm:col-start-auto sm:text-right">{money(item.amount)}</strong>
          </li>)}
        </ol>
      </section>
    </> : <p className={`${material.glassSecondary} p-5`}>Les données de juillet ne sont pas disponibles pour cette simulation.</p>}
  </div>;
}

function Metrics({ values }: { values: readonly (readonly [string, string | null])[] }) {
  return <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
    {values.map(([label, amount]) => <div key={label} className={`${material.centralScenario} px-3 py-2`}>
      <dt className="text-xs font-bold">{label}</dt>
      <dd className={`${material.money} mt-1 text-base font-black`}>{amount === null ? "À renseigner" : money(amount)}</dd>
    </div>)}
  </dl>;
}
