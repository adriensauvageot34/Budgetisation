import type { previewPlannedExpense } from "./planned-expenses-actions";

type Preview = Extract<Awaited<ReturnType<typeof previewPlannedExpense>>, { ok: true }>["value"];
const money = (value: string) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value));
export function PlannedImpactCard({ preview, fundingIncomplete }: { preview: Preview; fundingIncomplete: boolean }) {
  return <article className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5" aria-label="Effet sur notre mois">
    <div><p className="text-sm font-semibold">Coût prévu</p><p className="text-2xl font-black">{money(preview.grossCost)}</p></div>
    {Number(preview.absorbedByBaseline.central) > 0 && <p className="text-sm">Déjà compris dans votre quotidien estimé : <strong>{money(preview.absorbedByBaseline.central)}</strong></p>}
    <div><h4 className="text-base font-bold">S’ajoute au mois</h4><p className="text-3xl font-black text-emerald-950">{money(preview.netAdditionalImpact.central)}</p><p className="text-xs text-slate-600">Estimation centrale, selon nos habitudes</p></div>
    <section className="rounded-xl bg-white p-4 text-sm"><h4 className="font-bold">Paiement prévu</h4><p>Montant à payer : {money(preview.payableGross)}</p>
      {fundingIncomplete ? <p className="mt-2 font-semibold text-amber-900">Financement à compléter. L’effet économique reste calculable.</p> : <>
        <p className="mt-2 font-bold">Banque · {money(preview.projectPayment.bank)}</p>
        <p className="text-xs text-slate-600">{money(preview.funding.bankReserved)} déjà prévus dans les projets du mois.</p>
        {([ ["Swile", preview.funding.swile, preview.projectPayment.swile], ["Edenred", preview.funding.edenred, preview.projectPayment.edenred] ] as const).filter(([, pocket, payment]) => Number(payment) > 0 || Number(pocket.shortfall) > 0).map(([label, pocket, payment]) => <div key={label} className="mt-2">
          <p className="font-semibold">{label} · {money(payment)}</p><p>Ressource prévue du mois : {money(pocket.resource)} · réservée : {money(pocket.reserved)} · utilisée déclarée : {money(pocket.usedDeclared)}</p>
          <p>Ressource restante projetée : {money(pocket.availableAfter)}</p>
          {Number(pocket.shortfall) > 0 && <p className="font-bold text-amber-900">Financement à compléter : {money(pocket.shortfall)}. Choisissez comment couvrir cette part.</p>}
        </div>)}{(Number(preview.projectPayment.swile) > 0 || Number(preview.projectPayment.edenred) > 0 || Number(preview.funding.swile.shortfall) > 0 || Number(preview.funding.edenred.shortfall) > 0) && <p className="mt-2 text-xs text-slate-600">Les réservations couvrent tous les projets du mois. Un manque sur Swile ou Edenred conserve le paiement choisi et doit être réparé explicitement.</p>}
      </>}
    </section>
    {Number(preview.fuelUsage) > 0 && <section className="text-sm"><h4 className="font-bold">Usage carburant estimé</h4><p>{money(preview.fuelUsage)} inclus dans le coût prévu. Il s’agit d’essence consommée ; aucun plein payé n’est prévu par cette ligne.</p></section>}
    <section className="rounded-xl bg-emerald-950 p-4 text-white"><h4 className="font-bold">Reste projeté en fin de mois</h4><p className="text-3xl font-black">{money(preview.after.central)}</p><p className="text-xs text-emerald-100">Estimation centrale du mois, titres-restaurants inclus.</p></section>
    <details className="text-sm"><summary className="cursor-pointer font-semibold">Fourchette et explications</summary><p className="mt-2">{preview.explanation}</p>
      <p className="mt-2">Banque sur le mois : {money(preview.funding.bankAllocated)} prévus · {money(preview.funding.bankUsedDeclared)} déclarés.</p>
      {([ ["Swile", preview.funding.swile], ["Edenred", preview.funding.edenred] ] as const).map(([label, pocket]) => <p key={label}>{label} : {money(pocket.resource)} de ressource · {money(pocket.reserved)} réservés · {money(pocket.usedDeclared)} utilisés déclarés · {money(pocket.availableAfter)} restants projetés.</p>)}
      <div className="mt-2 grid grid-cols-2 gap-2"><p>Si on dépense peu : {money(preview.after.lowConsumption)} restants · {money(preview.netAdditionalImpact.low)} ajoutés au mois</p><p>Si le mois coûte plus : {money(preview.after.highConsumption)} restants · {money(preview.netAdditionalImpact.high)} ajoutés au mois</p></div>
      <p className="mt-2 text-xs">Ce sont des estimations mensuelles. Elles ne donnent pas un solde bancaire futur ni une autorisation de dépenser.</p>
    </details>
  </article>;
}
