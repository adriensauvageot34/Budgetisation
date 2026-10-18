import {plannerKeys,plannerRecord,plannerString} from "./json";
/** Prospective meaning only. Cost evaluation remains exclusively in the Compiler/V2. */
export type ComponentEconomicScope = Readonly<{version:"component-economic-scope@v1";
  kind:"AGGREGATED_SUBSTITUTIVE_ESTIMATE"|"ADDITIVE_CONTRIBUTION";coveredSelectionIds:readonly string[]}>;
export function parseComponentEconomicScope(raw:unknown,selectionId:string):ComponentEconomicScope{
  const v=plannerRecord(raw);plannerKeys(v,["version","kind","coveredSelectionIds"]);
  if(v.version!=="component-economic-scope@v1"||!["AGGREGATED_SUBSTITUTIVE_ESTIMATE","ADDITIVE_CONTRIBUTION"].includes(String(v.kind))
    ||!Array.isArray(v.coveredSelectionIds)||!v.coveredSelectionIds.length||v.coveredSelectionIds.length>500)throw new TypeError("COMPONENT_ECONOMIC_SCOPE_INVALID");
  const ids=v.coveredSelectionIds.map(plannerString);
  if(new Set(ids).size!==ids.length||!ids.includes(selectionId)||v.kind==="ADDITIVE_CONTRIBUTION"&&(ids.length!==1||ids[0]!==selectionId))throw new TypeError("COMPONENT_ECONOMIC_SCOPE_INVALID");
  return {version:"component-economic-scope@v1",kind:v.kind as ComponentEconomicScope["kind"],coveredSelectionIds:[...ids].sort()};
}
