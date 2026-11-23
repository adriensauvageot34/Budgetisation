import Link from "next/link";
import { notFound } from "next/navigation";
import { withProductAuthentication } from "@/app/product-query";
import { parseYearMonth } from "@/core/time";
import { JULY_COMPOSER_EDIT_HREF, JULY_COMPOSER_HREF, JULY_COMPOSER_MONTH } from "@/domain/phase2/planner/realized-month-entry";
import { getBootstrapContext } from "@/server/bootstrap/context";
import { plannerComposerEnabled } from "@/server/phase2/planner/cutover";
import { readRealizedMonth } from "@/server/phase2/planner/realized-month";
import { money, monthLabel } from "../composer/display";
import material from "../month-material.module.css";

export const metadata = { title: "Juillet V2" };

export default async function JulyV2Page() {
  const context = await withProductAuthentication(() => getBootstrapContext());
  if (!context.household) notFound();
  const july = context.periods.find(period => period.month === `${JULY_COMPOSER_MONTH}-01`);
  const observed = july?.financeStatus === "complete" || july?.financeStatus === "partial";
  const board = observed ? await readRealizedMonth(context, parseYearMonth(JULY_COMPOSER_MONTH)) : null;
  const composerEnabled = plannerComposerEnabled();
  const totals = board ? [
    ["Revenus encaissés", board.totals.income.amount],
    ["Dépenses débitées", board.totals.expense.amount],
    ["Remboursements reçus", board.totals.refund.amount],
    ["Net hors transferts", board.net],
  ] : [];
  return <div className={`${material.page} mx-auto max-w-5xl space-y-5`}>
    <header className={`${material.glassPremium} ${material.glassHero} p-6 sm:p-9`}>
      <p className="eyebrow"><time dateTime={JULY_COMPOSER_MONTH}>{monthLabel(JULY_COMPOSER_MONTH)}</time></p>
      <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Juillet V2</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-600">Retrouve les cartes de juillet et le brouillon reconstitué à partir des opérations du mois.</p>
      <nav aria-label="Accès du mois de juillet" className="mt-6 flex flex-wrap gap-3">
        {board && <Link href={composerEnabled ? JULY_COMPOSER_HREF : `/historique/${JULY_COMPOSER_MONTH}`} prefetch={false} className={`${material.clayPrimary} inline-flex items-center px-4 py-2.5 text-sm font-bold`}>Réalisé de juillet</Link>}
        {composerEnabled && <Link href={JULY_COMPOSER_EDIT_HREF} prefetch={false} className={`${material.clayButton} inline-flex items-center px-4 py-2.5 text-sm font-bold`}>Composer juillet</Link>}
      </nav>
    </header>
    {board && <section className={`${material.glassSecondary} p-5 sm:p-6`} aria-labelledby="july-v2-totals">
      <h2 id="july-v2-totals" className="text-lg font-black">Bilan bancaire de juillet</h2>
      <p className="mt-1 text-sm text-slate-600">{board.operationCount} opérations bancaires importées{july?.financeStatus === "partial" && " · couverture partielle"}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {totals.map(([label, amount]) => <div key={label} className={`${material.centralScenario} px-3 py-2`}>
          <dt className="text-xs font-bold">{label}</dt>
          <dd className={`${material.money} mt-1 text-base font-black sm:text-lg`}>{money(amount)}</dd>
        </div>)}
      </dl>
    </section>}
    <section className={`${material.glassSecondary} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-5 sm:p-6`} aria-labelledby="july-v2-plan">
      <div>
        <h2 id="july-v2-plan" className="text-lg font-black">Préparer le mois courant</h2>
        <p className="mt-1 text-sm text-slate-600">Retrouve les prévisions du mois et les montants à compléter.</p>
      </div>
      <nav aria-label="Accès au mois courant" className="flex flex-wrap items-center gap-3">
        <Link href="/mois-a-venir" prefetch={false} className={`${material.clayButton} inline-flex items-center px-4 py-2 text-sm font-bold`}>Mois à venir</Link>
        <Link href="/mois-a-venir?control=choices" prefetch={false} className={`${material.clayButton} inline-flex items-center px-4 py-2 text-sm font-bold`}>Centre de contrôle</Link>
      </nav>
    </section>
  </div>;
}
