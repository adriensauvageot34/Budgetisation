/** DD6 proof index, not a rule engine. Each proof names an executable existing
 * runner and a discriminant present in that runner. No business expected values. */
const proof=(RUNNER,EVIDENCE)=>({RUNNER,EVIDENCE});
const runners={domain:"scripts/check-phase2-planned-domain.mjs",server:"scripts/check-phase2-planned-server-contract.mjs",
  builder:"scripts/check-phase2-planned-builder.mjs",finance:"scripts/check-phase2-planned-finance.mjs",
  routes:"scripts/check-phase2-planned-routes.mjs",reality:"scripts/check-phase2-planned-reality.mjs",
  reliability:"scripts/check-phase2-planned-reliability.mjs",calendar:"scripts/check-phase2-planned-calendar.mjs",
  guards:"scripts/check-phase2-planned-guards.mjs",rls:"supabase/tests/phase2_planned_expenses_rls.sql"};
const owner={rules:"src/domain/phase2/planned-rules.ts",builder:"src/domain/phase2/planned-builder.ts",
  money:"src/server/phase2/month-scenario.ts",routes:"src/domain/phase2/planned-routes.ts",
  service:"src/server/phase2/planned-expenses.ts",places:"src/domain/phase2/planned-places.ts",
  calendar:"src/app/mois-a-venir/planned-expenses-projection.ts",memory:"src/server/phase2/planned-expenses.ts"};
const row=(RULE_ID,OWNER,ORACLE,DOMAIN_PROOF=[],SERVER_PROOF=[],NEGATIVE_PROOF=[],METAMORPHIC_PROOF=[],USER_FLOW_PROOF="PENDING_C10",HORIZON="V1")=>
  ({RULE_ID,OWNER,HORIZON,DOMAIN_PROOF,SERVER_PROOF,USER_FLOW_PROOF,NEGATIVE_PROOF,METAMORPHIC_PROOF,ORACLE});
const p=(key,evidence)=>proof(runners[key],evidence);
const globalRows=[
  [owner.service,"reliability","roots.filter(row => row.id === request.id).length"],
  [owner.service,"reality","DECLARED_REALIZED"],
  [owner.calendar,"calendar","occurrence.length"],
  [owner.money,"calendar","state.plan.plannedExpenses.grossCost"],
  [owner.rules,"server","MODULE_PATH_INVALID"],
  [owner.rules,"server","MODULE_PATH_INVALID"],
  [owner.rules,"domain","assert.notEqual(edge.childModule, \"transport\")"],
  [owner.rules,"domain","bring_items:"],
  [owner.places,"server","MERCHANT_AS_PLACE_INVALID"],
  [owner.service,"guards","historical authority mutation"],
  [owner.service,"reliability","trustedRouteCost"],
  [owner.calendar,"calendar","fresh reload is the sole projection source"],
  [owner.money,"finance","funding is orthogonal"],
].map(([file,runner,evidence],i)=>row(`GLOBAL-${String(i+1).padStart(2,"0")}`,file,
  i===3||i===12?"MATHEMATICAL_INVARIANT":"STATIC_CONTRACT",[p(runner,evidence)],
  [p("guards","ZERO-WRITE")],[p("server","DRAFT_FIELDS_INVALID")],[p("guards","targeted root predicate")]));
const abEvidence=["SAVE_READY","funding leaves","date is nullable","place is a Save requirement","suggestions create no cost",
  "accepted Gift survives","forbidden child","derived values may leave","explicit route is suspended","META-14","old Preview token","client readiness cannot legalize"];
// AB-01 proof uses its actual implication assertion rather than a label in output.
abEvidence[0]="!ready.saveReady || ready.previewReady";
const adaptive=abEvidence.map((e,i)=>row(`AB-${String(i+1).padStart(2,"0")}`,owner.builder,"STATIC_CONTRACT",[p("builder",e)],
  [p(i===11?"reliability":"server",i===11?"trustedFundingResult":"parsePlannedExpenseDraft")],
  [p("builder","parseWrite")],[p("builder",i===10?"revision":"undoBuilderChange")]));
const costs=["gross before","45.00","AGGREGATE_DESCENDANTS_ACTIVE","65","COLLAPSE_INCOMPATIBLE","ECONOMIC_ONLY"];
costs[0]="COST-ADAPT-01..04"; costs[5]="fuel economic-only";
const costRows=costs.map((e,i)=>row(`COST-ADAPT-${String(i+1).padStart(2,"0")}`,owner.builder,"USER_DECLARED_FIXTURE",
  [p("builder",e)],[p("server","AGGREGATE_DESCENDANTS_ACTIVE")],[p("builder","COLLAPSE_INCOMPATIBLE")],
  [p("builder","splitRestaurantQuickTotal")]));
const draftRows=["delivery","ownHome","noBirthday.acceptedChildren","autoCedric","new Set(undoBuilderChange"]
  .map((e,i)=>row(`DRAFT-${String(i+1).padStart(2,"0")}`,owner.builder,"STATIC_CONTRACT",[p("builder",e)],
    [p("guards","draft context change + local Undo")],[p("builder","suspended")],[p("builder","undoBuilderChange")]));
draftRows[0].DOMAIN_PROOF=[p("builder","delivered")];
const finEvidence=["funding is orthogonal","baseline changes","before[scenario]","Included","lifecycle preserves","no payments",
  "marginal impact is zero","shortfall"];
finEvidence[3]="absorbedByBaseline"; finEvidence[5]="Fuel economic-only";
const financeRows=finEvidence.map((e,i)=>row(`FIN-${String(i+1).padStart(2,"0")}`,owner.money,"MATHEMATICAL_INVARIANT",
  [p("finance",e)],[p("reliability","PARITY")],[p("finance","FUNDING")],[p("finance","META-")],"PENDING_C10"));
financeRows[5].DOMAIN_PROOF=[p("finance","FIN-06")];
const financeUiRows=Array.from({length:4},(_,i)=>row(`FIN-UI-${String(i+1).padStart(2,"0")}`,
  "src/app/mois-a-venir/planned-impact-card.tsx","STATIC_CONTRACT",
  [p("finance","FIN-UI-01..04")],[p("finance","netAdditionalImpact.central")],
  [p("finance","safe.to.spend")],[p("finance","marginal")]));
const localRows=["independent local place","no child transport","no implied route inclusion","orphan","nested transport",
  "consecutive identity collapses","Two different","two instances"]
  .map((e,i)=>row(`LP-${String(i+1).padStart(2,"0")}`,owner.rules,"STATIC_CONTRACT",[p("routes",e)],
    [p("calendar","Sync child place and route edits")],[p("routes","CHILD_PLACE_INVALID")],[p("routes","META-06")],"PENDING_C10"));
localRows[6].DOMAIN_PROOF=[p("routes","two different child types")];
const routeRows=["ROOT_PLACE","CHILD_LOCAL_PLACE","DIRECT_PLACE","assertRouteContinuity"]
  .map((e,i)=>row(i===3?"ROUTE-CONTINUITY":"ROUTE-BIND-0"+(i+1),owner.routes,"STATIC_CONTRACT",[p("routes",e)],
    [p("reliability","missingEvidence")],[p("routes","stop.endpointSource === \"ROOT_PLACE\"")],[p("routes","META-07")]));
const realRows=Array.from({length:7},(_,i)=>row(`REAL-${String(i+1).padStart(2,"0")}`,owner.service,"USER_DECLARED_FIXTURE",
  [p("reality",["needsRealityConfirmation","25", "canCollapseRealityCosts","fundingAfterGrossChange","67.00","beforeRestore","removed.rows.length"][i])],
  [p("reality","confirmPlannedExpenseReality")],[p("reality","STATUS_TRANSITION_INVALID")],[p("reality","scenarios")]));
const resilience=["IDEMP-CREATE-01","IDEMP-CREATE-02","IDEMP-REAL-01","STALE-REAL-01","STALE-EDIT","PARITY-01","PARITY-02","PARITY-03","PARITY-04","REPORT-01","REPORT-02"]
  .map(id=>{const real=/REAL|REPORT/u.test(id);return row(id,owner.service,"STATIC_CONTRACT",[],
    [p(real?"reality":"reliability",real?"REALITY_DRAFT_STALE":"PARITY")],
    [p(real?"reality":"reliability",real?"STATUS_TRANSITION_INVALID":"PLANNED_EXPENSE_EDIT_STALE")],
    [p(real?"reality":"reliability",real?"scenarios":"client.writes.length")]);});
const calendarRows=Array.from({length:27},(_,i)=>row(`CAL-${String(i+1).padStart(2,"0")}`,owner.calendar,"STATIC_CONTRACT",
  [p("calendar","CAL-")],[p("calendar","fresh reload")],[p("calendar","line-through")],[p("calendar","META-20")],"PENDING_C10"));
const rlsRows=["READ","CREATE","UPDATE","DELETE","DECLARE","RESTORE","REPORT","HOUSEHOLD_TAMPERING","FOREIGN_REFS"]
  .map(id=>row(`RLS-${id}`,"supabase/migrations/20260928163114_phase2_planned_expenses.sql","LIVE_CURRENT",[],
    [p(id==="FOREIGN_REFS"?"guards":"rls",id==="FOREIGN_REFS"?"foreign refs":"DD6_")],
    [p(id==="FOREIGN_REFS"?"guards":"rls",id==="FOREIGN_REFS"?"PERSON_NOT_IN_HOUSEHOLD":"DD6_FOREIGN")],[],"NOT_APPLICABLE"));
// Reference validation is a real-service synthetic fixture; SQL RLS is live.
rlsRows.at(-1).ORACLE="STATIC_CONTRACT";
const zeroRows=["Preview","Create","Update","Delete","Declare","Restore","Report","contact TEXT + user-declared place",
  "child local place","route/fuel Preview","route/fuel Save","draft context change + local Undo"]
  .map((e,i)=>row(`ZERO-WRITE-${String(i+1).padStart(2,"0")}`,owner.service,"MATHEMATICAL_INVARIANT",[],[p("guards",e)],
    [p("guards","historical authority mutation")],[p("guards","targeted root predicate")],"NOT_APPLICABLE"));
const memoryRows=Array.from({length:7},(_,i)=>row(`MEM-V1-${String(i+1).padStart(2,"0")}`,owner.memory,"STATIC_CONTRACT",
  [p("guards","MEM-V1-01..07")],[p("guards","TEXT remains intention")],[p("guards","DRAFT_FIELDS_INVALID")],
  [p("guards","Declared route")],"NOT_APPLICABLE"));
const memoryFuture=Array.from({length:8},(_,i)=>row(`MEM-${String(i+1).padStart(2,"0")}`,owner.memory,"STATIC_CONTRACT",[],[],[],[],"NOT_APPLICABLE","V1.1"));
export const ruleCoverage=[...globalRows,...adaptive,...costRows,...draftRows,...financeRows,...financeUiRows,...localRows,...routeRows,...realRows,...resilience,...calendarRows,...rlsRows,...zeroRows,...memoryRows,...memoryFuture];
export const metamorphicCoverage=Array.from({length:20},(_,i)=>{
  const key=i+1;
  const runner=key<=2?"builder":key<=5?"finance":key<=8?"routes":key<=13?"reality":key===14?"guards":key<=17?"reliability":key<=19?"guards":"calendar";
  const evidence={1:"!ready.saveReady || ready.previewReady",2:"splitRestaurantQuickTotal",14:"draft context change + local Undo",18:"contact TEXT + user-declared place",19:"Declared route",20:"META-20"}[key]
    ?? (runner==="reliability"?"PARITY":runner==="reality"?"scenarios":`META-${String(key).padStart(2,"0")}`);
  return {RULE_ID:`META-${String(key).padStart(2,"0")}`,ORACLE:"MATHEMATICAL_INVARIANT",PROOF:p(runner,evidence)};
});
