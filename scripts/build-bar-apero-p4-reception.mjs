/** Evidence index only. A classified criterion is not an executed E2E. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='docs/status/evidence/bar-apero-p4';
const source=JSON.parse(fs.readFileSync('scripts/fixtures/bar-apero-p4-cases.json'));
const states=JSON.parse(fs.readFileSync(dir+'/states.json'));
const codeSha='ccfefe0f4ee06e76c02eeaeb74e824cb587ebacf';
const logs={p1:'final-check-bar-apero-p1.log',p2:'final-check-bar-apero-p2.log',p3:'final-check-bar-apero-p3.log',p4:'final-check-bar-apero-p4.log',mob:'final-check-l4-d-bar-mobility.log',v8:'final-check-l4-e-bar-v8.log',l4:'final-check-l4-a.log'};
const proof=(file,test)=>{assert.ok(fs.readFileSync(dir+'/'+logs[file],'utf8').includes(test+' PASS'),test+' not PASS');return{file:logs[file],test,level:file==='mob'||file==='l4'?'DOMAIN_COMPILER_PGLITE':'REACT_SYNTHETIC',executed:true};};
const refs={
 empty:proof('p2','V2-02_BEER_THEN_STEPPER_ADMITTED_IN_TWO_GESTURES'),
 places:proof('p3','P3_01_05_PUBLIC_RANKING_HOMONYMS_AND_HONEST_COVERAGE'),
 home:proof('p3','P3_12_AMBIGUOUS_HOME_OR_VEHICLE_NO_SHORTCUT'),
 work:proof('p3','P3_13_14_CURRENT_WORK_IDENTITY_NOT_MEAL_OR_NAME'),
 place:proof('p1','P1-PLACE-01_UI_NO_LEGS_NO_CONFIRMATION'),
 legs:proof('p1','P1-ROUTE-01_MODE_ONE_LEG_AND_NO_AUTOFILL'),
 same:proof('p1','P1-ROUTE-02_SAME_MODE_CREATION_NO_LATER_SYNC'),
 mixed:proof('mob','BAR_RETURN_TAXI_ONLY_REMOVES_RETURN_FUEL'),
 car:proof('p1','P1-PRICE-02_VEHICLE_TOLL_STOPS_MANUAL_FUEL_RETAINED'),
 endpoint:proof('p1','P1-PRICE-01_UI_EXPLICIT_MANUAL_REDECLARATION_OR_UNKNOWN'),
 independent:proof('p3','P3_15_17_DIRECTED_RETURN_AND_PLACE_ONLY_MUTATION'),
 google:proof('p3','P3_06_10_GOOGLE_EXACT_AMBIGUOUS_RETRY_TEXT_STALE_NO_AUTO_CHOICE'),
 fallback:proof('p3','P3_18_22_TEXT_FALLBACK_NO_COORDINATE_AND_LATER'),
 outage:proof('mob','BAR_PROVIDER_OUTAGE_NOT_BOARD_FAILURE_AND_RESTORE_DIGEST'),
 legacy:proof('p2','V2_LEGACY_COMBINED_ROUTE_DISPLAYED_ONCE_WITH_STOPS'),
 units:proof('p4','P4_P4_ITEM_PERSON_SHARED_PRESENTS_INDEPENDENT_AND_ZERO'),
 raw:proof('p1','P1-RAW-01_CANCEL_DISCARD_REJECT_INVALID_AND_RETRY'),
 rawbefore:proof('p4','P4_BEFORE_RAW_REJECTION_CONTINUE_AND_SAVE_RETARGET'),
 stale:proof('p4','P4_D2_RESPONSE_GATE_AND_SEMANTIC_ROUNDTRIP_NO_APPLY'),
 undo:proof('p1','P1-UNDO-01_EXACT_FUNDED_BEER_ID_BINDING'),
 undoplace:proof('p1','P1-UNDO-02_ATOMIC_VENUE_ENDPOINT_PRICES_REDO'),
 before:proof('p4','P4_P5_BEFORE_RICH_UI_PARTIAL_PATCH_SAME_IDS_AND_OWNER_SUM'),
 product:proof('p4','P4_P5_SAME_PRODUCT_TWO_CONTEXTS_NO_MERGE_NO_PARENT_COST'),
 remove:proof('p4','P4_BEFORE_REMOVE_EXTRA_CARDINALITY_GROUP_CONFIRM_AND_UNDO'),
 global:proof('p4','P4_GLOBAL_DETAILS_EXACT_CONSENT_CANCEL_REPLACE_UNDO'),
 coverage:proof('p4','P4_SHARED_TOTAL_COLLISION_CANNOT_BYPASS_COVERAGE'),
 funding:proof('p4','P4_FUNDING_OVER_COST_BLOCKED_WITHOUT_REWRITING_PRICE'),
 external:proof('p1','P1-PRICE-03_EXTERNAL_MODE_BLOCKED_AND_FUNDED_ENDPOINT_BLOCKED'),
 month:proof('p4','P4_OUTSIDE_MONTH_REJECTED_AND_PROTECTED_OWNER'),
 locked:proof('p2','V2_PRESERVE_READONLY_PRESENTS_REASON_AND_NO_MUTATION'),
 reedit:proof('p2','V2-07_REEDIT_EXACT_SAME_LABEL_AND_REMOVE_UNDO'),
 quote:proof('p4','P4_QUOTE_UNTOUCHED_REEDIT_PRESERVES_UNKNOWN_FIELDS'),
 datespeople:proof('p2','V2-04_DATE_THREE_PEOPLE_NO_TRAILING_CONFIRMATION'),
 dense:proof('p2','V2-07_DENSE_8_AND_15_DISTINCT_IDS_COMPACT_TWO_PLUS_N'),
 apply:proof('p4','P4_RICH_BEFORE_PREVIEW_APPLY_RELOAD_MON_PLAN_SAME_IDS'),
 http:{file:'http-results.json',test:'Seven HTTP loopback assertions',level:'HTTP_LOOPBACK_SYNTHETIC',executed:true},
 geometry:{file:'geometry.json',test:'Measured desktop rectangles; 48a552f UI',level:'BROWSER_FIXTURE',executed:true}
};
// Status covers the full source criterion. Adjacent or narrower proof stays PARTIAL.
const adv=[
 ['PARTIAL','empty,http','UNKNOWN and identity persist in fixtures; exact one-beer close/reopen sequence not a separate P4 authenticated run.'],
 ['PARTIAL','places','Ranking and explicit search tested; exact refusal journey not replayed end-to-end.'],
 ['PASS','place,independent','Only central place admitted; no inferred leg.'],
 ['BLOCKED_OWNER','google,fallback','No durable Google admission owner. Explicit TEXT fallback tested; no provider identity or coordinates persisted.'],
 ['PASS','places,google','Distinct IDs for homonyms; exact mapping only in synthetic provider tests.'],
 ['PASS','home','Multiple homes suppress shortcut; no arbitrary first home.'],
 ['PASS','work','Meal anchor alone is not a workplace or participant proof.'],
 ['PASS','legs','Mode decision alone does not infer origin, destination or return.'],
 ['PARTIAL','mixed','Directed CAR/TAXI official costs tested; exact 10 km case not separately replayed.'],
 ['PASS','same,independent','Explicit new Return ID, autonomous endpoints and prices.'],
 ['PASS','independent','Central place change preserves both independent legs. No durable Bar binding exists.'],
 ['PASS','car','Targeted vehicle/stop/fare preservation assertions from P1.'],
 ['PASS','mixed','Return fuel removed, outbound unchanged, owner simulation only.'],
 ['PARTIAL','quote,stale','Unrelated edit preserves quoteKey; D1/D2 gate tested. Dated real Mobility quote compatibility NOT_RUN.'],
 ['PARTIAL','units','ITEM unaffected by six present people; exact two-to-four update not separately replayed.'],
 ['PASS','units','2 units/person ×2 priced persons ×8; present people independent; official aggregate 69.00.'],
 ['PARTIAL','units','Shared 25 with six present people tested, not the exact five-present variant.'],
 ['PASS','empty,before','UNKNOWN on admission; catalog historical default not silently adopted.'],
 ['FUTURE_CAPABILITY','raw','No published exact beer-price suggestion owner. Manual 8 and RAW tested, not a real suggestion refusal.'],
 ['PARTIAL','global,coverage','Explicit total replaces details 16 by30, no46; covered total plus retained details is not represented.'],
 ['BLOCKED_OWNER','','Autonomous ceiling/envelope contract absent. Cost input explicitly means economic cost; do not enter a maximum as a decided expense.'],
 ['PASS','raw,rawbefore','Continue, discard, save continuation and rejected admission retain honest states.'],
 ['PARTIAL','stale','Actual response gate rejects D1; exact rapid-edit browser timeline not instrumented.'],
 ['PASS','google','429, HTML, invalid details, stale generation and retry tested with mocked responses. NOT_RUN_PROVIDER.'],
 ['PASS','outage','Synthetic provider outage keeps Board and intentions, no invented cost.'],
 ['PASS','legacy','Combined legacy route remains once, stops and read-only behavior preserved.'],
 ['PASS','undo,reedit','Same selectionId, price, quantity and binding restored by semantic history tests.'],
 ['NOT_RUN_AUTH_P4','http','Loopback persistence is not Supabase JWT/new-session proof.'],
 ['PARTIAL','dense,geometry','Desktop geometry subset measured. Native drag, zoom125, mobile and full dense8 browser path not certified.'],
 ['PARTIAL','funding,apply','Official finance parity and funding block tested; exact envelope plus external bank-payment scenario not reconstructed. No real bank writes.'],
 ['PARTIAL','independent','Preserves custom endpoint and both legs; no admitted persistent Bar binding to update selectively.'],
 ['PASS','same,independent','Creation shortcut is not permanent synchronization.'],
 ['PARTIAL','endpoint,independent','Changing central Bar alone preserves independent Taxi12; changing its actual endpoint requires explicit re-declaration or UNKNOWN. No durable automatic binding.'],
 ['PASS','car','P1 vehicle/parking/quote invalidation tests; no provider claim.'],
 ['PASS','google','Late generation and unmount ignored by React tests, not a live Google run.'],
 ['PASS','units','Explicit MANUAL zero retained, distinct from UNKNOWN.'],
 ['PARTIAL','reedit','Two Beer identities and prices6/8 retained; exact same-bar semantic fixture differs only in absent venue.'],
 ['PASS','product','Same product in Before and Bar has two IDs; official aggregate79, no extra parent contribution.'],
 ['PASS','remove,before','Extra-only removal, required-main refusal, group confirmation and exact structure restoration. Browser Undo/Redo also observed on48a552f.'],
 ['BLOCKED_OWNER','coverage,units','No universal durable covered-detail relation. Explicit replace/add-independent/cancel fallback; PERSON is not silently covered.'],
 ['PASS','funding','Cost8 and allocation12 stay distinct; official BLOCK then targeted repair8; no silent truncation.'],
 ['PARTIAL','external,independent','External owner never locally re-owned; repair/POSSIBLE transition only when published. No new relation writer.'],
 ['PASS','month','Authoritative server rejects out-of-month; original Draft intact.'],
 ['PASS','locked,month','Protected/read-only cannot admit mutation or falsely show saved.'],
 ['PARTIAL','http,stale,raw','Lost response resolution/CAS/replay and D1 rejection tested separately; full simultaneous Back+reload+Undo browser race not run.']
];
const oracle=[
 ['PASS','independent','Context/component/leg identities preserved.'],['PASS','empty,http','UNKNOWN persisted; no invented zero.'],['PASS','units','Explicit zero retained.'],
 ['PARTIAL','units','12 official ITEM contribution with six present rather than exact five.'],['PASS','units','Official PERSON contribution32.'],['PASS','units','Official SHARED contribution25 with six present.'],
 ['PASS','global,coverage','30 replaces16 with explicit consent; no46.'],['BLOCKED_OWNER','','No autonomous ceiling contract; no fictitious capability.'],
 ['PARTIAL','mixed','No residual Return fuel; exact10km fixture not run.'],['PASS','same','New Return identity; no copied price.'],['PASS','independent','Custom endpoints remain autonomous.'],['PASS','mixed','Return only becomes Taxi.'],['PASS','car','Manual fare and relevant stops retained; scoped derived invalidation.'],
 ['PARTIAL','quote,stale','Dated provider quote refresh not tested; unrelated quote conservation and stale response gate only.'],['PASS','outage','Synthetic outage keeps intent and UNKNOWN.'],['PASS','google,places','No fuzzy remapping; exact mocked identity checks.'],
 ['PASS','google,fallback','Safety oracle passes on mocked source; durable Google capability remains BLOCKED_OWNER.'],['PARTIAL','home,place','No implicit home admission; exact decline interaction not replayed.'],
 ['PASS','raw,rawbefore','Three honest RAW outcomes; browser Continue/Save on Before.'],['PASS','raw,rawbefore','Rejected mutation keeps RAW and previous semantic state.'],['PASS','stale','Gate D1 rejected when current D2.'],['PASS','undo,reedit','Undo restores exact selection.'],['PASS','undoplace','Atomic history snapshot restores earlier venue/endpoints.'],['PASS','before,remove,product','Child structure and owner totals preserved; no additive parent.'],['PASS','legacy','Legacy combined route retained.'],
 ['PARTIAL','http','Rich Before/components/prices persist through HTTP; directed legs are proven separately in owner/Apply tests, not in this exact combined HTTP journey.'],['NOT_RUN_AUTH_P4','','No P4 authorized isolated JWT write session.'],['PASS','stale','Official digest tests and D2 gate; no live provider certification.'],['PARTIAL','dense,geometry','Desktop subset and pure dense layout; zoom/native drag/mobile NOT_RUN.'],['PARTIAL','rawbefore','Browser buttons, focus and RAW tested; native drag and full keyboard circuit not certified.'],['PARTIAL','funding,apply','Finance198 parity and rich official persistence; exact covered-envelope/bank-payment mix not reconstructed.'],['PASS','month','Server month scope refuses invalid date.'],['PASS','locked,month','No false admission while protected.'],['PARTIAL','dense,reedit','Stable React selection/IDs; full rapid reflow mount-count browser assertion not run.'],['PASS','reedit,before','Direct target identity, no cloned item.']
];
assert.equal(adv.length,45);assert.equal(oracle.length,35);
const rows=[...source.scenarios,...source.oracles].map((criterion,index)=>{
 const [status,keys,observed]=index<45?adv[index]:oracle[index-45];
 const evidence=keys?keys.split(',').map(key=>{assert.ok(refs[key],key);return refs[key];}):[];
 return{...criterion,status,observed,evidence,testedProductSha:codeSha,scope:'Synthetic only unless a BROWSER_FIXTURE entry explicitly says otherwise',auth:'NOT_RUN_AUTH_P4',provider:'NOT_RUN_PROVIDER',financialOwner:'Compiler / Finance V2 / Mobility unchanged',financialEvidence:evidence.some(e=>['units','before','product','global','funding','apply'].some(k=>refs[k]===e))?'states.json (official summaries/digests), no local sum':'See named assertion; no additional amount inferred',blockingForHumanReview:false,blockingForUniversalReference:['BLOCKED_OWNER','NOT_RUN_AUTH_P4','FUTURE_CAPABILITY','PARTIAL'].includes(status)};
});
const counts=Object.fromEntries([...new Set(rows.map(r=>r.status))].map(status=>[status,rows.filter(r=>r.status===status).length]));
const result={schemaVersion:1,source:source.source,sourceSha256:source.sha256,productSha:codeSha,classificationIsNotEightyExecutedTests:true,count:80,counts,rows};
fs.writeFileSync(dir+'/acceptance-matrix.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({entries:rows.length,counts,officialExamples:Object.fromEntries(Object.entries(states).filter(([,v])=>v.summary).map(([k,v])=>[k,{knownAmount:v.summary.knownAmount,digest:v.digest}]))}));
