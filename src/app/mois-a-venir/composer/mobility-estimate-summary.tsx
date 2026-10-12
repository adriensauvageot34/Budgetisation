import type { ComposerMobilitySummary } from "@/domain/phase2/planner/composer-ui-contract";
import { money } from "./display";

const sources: Record<string, string> = { TOMTOM: "TomTom", HISTORICAL_ROUTE: "Historique comparable dans ce sens",
  MANUAL: "Déclaration utilisateur", FR_GOV_FUEL_INSTANT_V2: "Prix officiel carburant", CANONICAL_OBSERVATION: "Observation carburant conservée",
  HERE: "HERE", NONE: "Aucun provider de péage" };
/** Display only. Values come from the unique Mobility owner through the Compiler. */
export function MobilityEstimateSummary({ summary, fresh = true }: { summary?: ComposerMobilitySummary; fresh?: boolean }) {
  if (!fresh) return <p role="status">Estimation en attente de la nouvelle simulation. Le brouillon reste modifiable.</p>;
  if (!summary) return <p>Trajet à préciser. Aucun coût de déplacement n’est inventé.</p>;
  return <section aria-label="Estimation du déplacement" className="grid gap-2 rounded-xl border border-slate-200 p-3 text-sm">
    <strong>{summary.status === "RESOLVED" ? "Estimation renseignée" : summary.status === "PARTIAL" ? "Estimation partielle" : "Estimation indisponible"}</strong>
    {summary.vehicleLabel && <p>Véhicule : {summary.vehicleLabel}</p>}
    <dl className="grid gap-1"><div><dt>Distance du trajet complet</dt><dd>{summary.distanceKm === null ? "Inconnue" : `${summary.distanceKm} km`}</dd></div>
      <div><dt>Carburant utilisé estimé</dt><dd>{summary.economicFuel === null ? "Inconnu" : money(summary.economicFuel)} · coût d’usage, pas un plein payé</dd></div>
      <div><dt>Péages</dt><dd>{summary.toll === null ? "Inconnus" : money(summary.toll)}</dd></div>
      <div><dt>Parking</dt><dd>{summary.parking === null ? "Inconnu ou non concerné" : money(summary.parking)}</dd></div>
      <div><dt>Billet ou course déclarée</dt><dd>{summary.fare === null ? "Inconnu ou non concerné" : money(summary.fare)}</dd></div>
      <div><dt>Frais à financer</dt><dd>{summary.cashTransport === null ? "À préciser" : money(summary.cashTransport)}</dd></div></dl>
    <p>Sources : {summary.routeSource ? sources[summary.routeSource] ?? summary.routeSource : "itinéraire non résolu"}
      {summary.fuelSource ? ` · ${sources[summary.fuelSource] ?? summary.fuelSource}` : ""}
      {summary.tollSource ? ` · ${sources[summary.tollSource] ?? summary.tollSource}` : ""}</p>
    {summary.timeBasis === "TYPICAL_NO_DATE" && <p>Trajet type sans date fixée ; il pourra varier au moment du départ.</p>}
    {!!summary.fallbacks.length && <p>Des références de repli ou des informations manquantes qualifient cette estimation. Aucun prix fournisseur absent n’est remplacé silencieusement.</p>}
  </section>;
}
