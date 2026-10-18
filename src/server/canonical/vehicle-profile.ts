import "server-only";

/** Exact vehicle declaration emitted by the existing Canonical import owner.
 * No parsing of free labels, nor inference of an unknown vehicle's engine. */
export const CANONICAL_PEUGEOT_207=Object.freeze({
  modelRef:"peugeot-207-1.4-vti95-bvm5-sp95@tomtom-v1",
  fullLabel:"Peugeot 207 2010 — 1.4 VTi 95 — SP95 — BVM5",
  brand:"Peugeot",model:"207",displayName:"Peugeot 207",technicalLabel:"2010 — 1.4 VTi 95 — SP95 — BVM5",
  fuelType:"SP95",source:"canonical_mobility_xlsx@v1",
} as const);
export function canonicalVehiclePresentation(row:{label:string;fuel_type:string}){
  return row.label===CANONICAL_PEUGEOT_207.fullLabel&&row.fuel_type===CANONICAL_PEUGEOT_207.fuelType
    ?{version:"canonical-vehicle-presentation@v1" as const,brand:CANONICAL_PEUGEOT_207.brand,model:CANONICAL_PEUGEOT_207.model,
      displayName:CANONICAL_PEUGEOT_207.displayName,technicalLabel:CANONICAL_PEUGEOT_207.technicalLabel,modelRef:CANONICAL_PEUGEOT_207.modelRef,source:CANONICAL_PEUGEOT_207.source}:undefined;
}
