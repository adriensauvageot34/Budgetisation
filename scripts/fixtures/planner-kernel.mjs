import { require } from "../lib/phase2-ts-loader.mjs";
const { defaultMonthInputs, monthInputsSchema } = require("@/server/phase2/month-scenario");
const { emptyPlanSemanticState } = require("@/domain/phase2/planner/semantic-state");
const { planningBaselineDigest } = require("@/server/phase2/planner/baseline");
const { planSlotId } = require("@/domain/phase2/planner/identity");
export const householdId = "11111111-1111-4111-8111-111111111111", userId = "22222222-2222-4222-8222-222222222222";
export const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
export const emptyState = () => emptyPlanSemanticState("2026-11");
export const control = (key, value, n=1) => ({ decisionId: uuid(n), decisionSlotKey: key, kind: "SET_STATE", value, provenance: "EXPLICIT_USER_DECISION" });
export function context({ n=100, slot="restaurants", relation="CONSUMES_SLOT", displacement="KNOWN", amount=null, count="1.00", cost="30.00", quote=null, funding=[] }={}) {
  return { contextOccurrenceId: uuid(n), templateKey:"kernel.generic", status:"ACTIVE", fields:{label:"Synthetic intention",plannedDate:"2026-11-12"},
    slotSelections:{ primary:{ quantity:"1", cost:quote?{kind:"QUOTE",quoteKey:quote}:cost===null?{kind:"UNKNOWN"}:{kind:"MANUAL",unitAmount:cost},
      binding:{slotIdentityKey:slot,relation,displacement,amount,count},fundingAllocations:funding } },provenance:"EXPLICIT_USER_DECISION" };
}
const range = value => ({ low:value,central:value,high:value });
const component = (key, value) => ({ key,label:key,nature:"CONTRACTUAL_EXPECTED",additiveGroup:"obligations",knowledgeState:"PROBABLE",...range(value) });
const part = (key, value) => ({key,...range(value),method:"synthetic-reference@v1",observationCount:6,provenance:[`synthetic:${key}`],note:null,
  decisionCapabilities:{label:key,role:"BEHAVIORAL",adjustability:"ADJUSTABLE",strategies:["TEST_AMOUNT"],targetAllowed:true} });
export function slot(key, kind, amount, count=null, unitAmount=null) {
  return { planSlotId:planSlotId(key),slotIdentityKey:key,controlKey:key==="restaurants"?"household-restaurants":key,semanticKey:key,
    kind,scope:{kind:"HOUSEHOLD"},inclusion:"CENTRAL",baselineValue:{amount,count,unitAmount,minimumAmount:null,dueState:null},
    sourceRefs:[`synthetic:${key}`],knowledge:"KNOWN",provenance:["CANONICAL_HISTORY"],
    capabilities:[{action:kind==="AMOUNT"?"SET_AMOUNT":"SET_COUNT",availability:"AVAILABLE",reason:null}] };
}
export function seal(world) { world.baseline.digest=planningBaselineDigest(world.baseline); return world; }
export function fixture() {
  const inputs = monthInputsSchema.parse({...defaultMonthInputs(), safetyReserve:"0.00",declaredResources:{"benefit:swile":"0.00","benefit:edenred":"0.00"},
    declaredOutflows:[{id:uuid(700),label:"Synthetic adjustable saving",kind:"SAVINGS",amount:"100.00",dueDate:null,adjustability:"ADJUSTABLE",source:"MONTH_INPUT",annualGoalRef:null}]});
  const baseline = {version:"planning-baseline@v1",householdId,targetMonth:"2026-11",knowledgeCutoff:"2026-10-05T10:00:00Z",digest:"",
    structuralFacts:{resources:[],obligations:[],savingsReservations:[{reservationId:uuid(700),label:"Synthetic adjustable saving",amount:"100.00",dueDate:null,
      adjustability:"ADJUSTABLE",source:"MONTH_INPUT",annualGoalRef:null,provenance:"CANONICAL_FACT",sourceRefs:["synthetic:savings"]}],externalKnownContexts:[]},
    slots:[slot("restaurants","OCCURRENCE",null,"3.00","20.00"),slot("clothing","AMOUNT","50.00"),slot("groceries","AMOUNT","100.00")],
    unresolvedReserves:[],sourceRefs:[],modelVersions:{builder:"synthetic-baseline@v1"},diagnostics:[]};
  const forecast = {meta:{targetMonth:"2026-11",sourcePublicationId:"synthetic-publication",sourceRevision:1,analyticsRevision:1,computedAt:"2026-10-05T10:00:00Z"},
    publicationMeta:{publicationId:"synthetic-publication",revision:1,factsHash:"synthetic",manifestHash:"synthetic"},
    resourceMeta:{contractVersion:"synthetic-forecast@v1",methodSignature:"synthetic",policyVersions:{},resourceInputHash:"synthetic"},
    income:{...range("2000.00"),components:[{key:"income:Digital Learning Contest",label:"Synthetic salary A",central:"1000.00"},
      {key:"income:Promotrans",label:"Synthetic salary B",central:"1000.00"}]},components:[component("obligation:rent","500.00")],obligations:range("500.00"),
    economicCost:range("710.00"),freeToSpend:range("1290.00"),cash:{grossBeforeUnconfirmedFunding:range("710.00")},reserve:{amount:"0.00"},
    referencePlan:{targetMonth:"2026-11",necessary:[part("groceries","100.00")],flexible:[part("household-restaurants","60.00"),part("clothing","50.00")],
      necessaryTotal:range("100.00"),flexibleTotal:range("110.00"),restaurantCorpus:[],excludedRestaurantSubcategories:[],estimatedDays:{}}};
  return seal({baseline,forecast,monthInputs:inputs,externalIntents:[],asOfDate:"2026-10-05",costQuotes:{},modelVersions:{financialOwner:"deriveMonthScenario@v2"}});
}
export function externalExpense(n=800) {
  return {id:uuid(n),householdId,targetMonth:"2026-11",status:"PLANNED",familyKey:"food",subtypeKey:"restaurant",title:"Synthetic external intent",
    plannedDate:"2026-11-15",costItems:[{id:uuid(n+1),assetKey:null,label:"External restaurant",quantity:"1",unitAmount:"30.00",baselineKey:"household-restaurants"}],
    context:{},createdBy:userId,updatedBy:userId,createdAt:"2026-10-05T00:00:00Z",updatedAt:"2026-10-05T00:00:00Z"};
}
