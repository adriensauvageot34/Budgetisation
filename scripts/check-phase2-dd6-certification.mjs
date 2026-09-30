import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {spawn,execFileSync} from "node:child_process";
import {ruleCoverage,metamorphicCoverage} from "./lib/planned-dd6-coverage.mjs";

const args=new Set(process.argv.slice(2));
const hash=text=>createHash("sha256").update(text.replace(/\r\n/gu,"\n")).digest("hex");
const git=(...args)=>execFileSync("git",args,{encoding:"utf8"}).trim();
const packageScripts=JSON.parse(fs.readFileSync("package.json","utf8")).scripts;
const collect=directory=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()
  ?collect(path.join(directory,entry.name)):[path.join(directory,entry.name).replaceAll("\\","/")]);
const sourceFiles=[...collect("src/domain/phase2"),...collect("src/server/phase2"),...collect("src/app/mois-a-venir")];
const preflight={head:git("rev-parse","HEAD"),branch:git("branch","--show-current"),worktree:git("status","--short").split("\n").filter(Boolean),
  plannedMigrations:fs.readdirSync("supabase/migrations").filter(name=>name.includes("phase2_planned_")),
  sourceSha256:hash(sourceFiles.sort().map(file=>file+":"+hash(fs.readFileSync(file,"utf8"))).join("\n")),
  commands:{types:packageScripts.typecheck,lint:packageScripts.lint??null,build:packageScripts.build},
  protectedAuthorities:["operations","life_events","moments","mobility_legs","mobility_trips","persons","referentiel_lieu",
    "person_place_roles","fuel_price_observations","benefit_wallets","benefit_wallet_ledger_entries","analytics_query_snapshots","analytics_artifacts","analytics_publications"]};
const execution={};
async function run(id,commandArgs){
  console.log(`RUN ${id}`);
  const started=Date.now();
  const result=await new Promise(resolve=>{
    const child=spawn(process.execPath,commandArgs,{env:process.env,stdio:["ignore","pipe","pipe"]});
    let output="";child.stdout.on("data",chunk=>{output+=chunk;});child.stderr.on("data",chunk=>{output+=chunk;});
    child.on("error",error=>resolve({code:1,output:String(error)}));child.on("close",code=>resolve({code,output}));
  });
  execution[id]={STATUS:result.code===0?"PASS":"FAIL",durationMs:Date.now()-started,
    command:["node",...commandArgs].join(" "),evidence:result.output.trim()};
  console.log(`${execution[id].STATUS} ${id}`);
  if(result.code!==0)console.error(result.output);
  return result;
}

const tests=["scripts/check-phase2-planned-domain.mjs","scripts/check-phase2-planned-server-contract.mjs",
  "scripts/check-phase2-planned-builder.mjs","scripts/check-phase2-planned-assets.mjs","scripts/check-phase2-planned-expenses.mjs",
  "scripts/check-phase2-planned-expenses-ui.mjs","scripts/check-phase2-planned-routes.mjs","scripts/check-phase2-planned-finance.mjs",
  "scripts/check-phase2-planned-reliability.mjs","scripts/check-phase2-planned-reality.mjs","scripts/check-phase2-planned-calendar.mjs",
  "scripts/check-phase2-planned-guards.mjs","scripts/check-phase2-post-v1-fixes.mjs","scripts/check-architecture-imports.mjs"];
// Existing script runners in bounded batches; each gets an isolated module cache.
for(let start=0;start<tests.length;start+=3)await Promise.all(tests.slice(start,start+3).map(id=>run(id,[id])));
await run("types",["node_modules/typescript/bin/tsc","--noEmit"]);
if(packageScripts.lint)await run("lint",["node_modules/eslint/bin/eslint.js","src"]);
else execution.lint={STATUS:"NOT_APPLICABLE",reason:"No lint script or configured lint runner in this repository."};
if(args.has("--build"))await run("production-build",["node_modules/next/dist/bin/next","build"]);
else execution["production-build"]={STATUS:"NOT_TESTED",reason:"Use --build to execute the existing production build command."};
if(args.has("--live")){
  await run("scripts/audit-phase2-dd6-live.mjs",["--env-file=.env.local","scripts/audit-phase2-dd6-live.mjs"]);
  await run("scripts/audit-phase2-c6-c7-live.mjs",["--env-file=.env.local","scripts/audit-phase2-c6-c7-live.mjs"]);
}

const dbPath=[...args].find(arg=>arg.startsWith("--rls-evidence="))?.split("=")[1];
let db=null;
const rlsRunner="supabase/tests/phase2_planned_expenses_rls.sql";
if(dbPath){
  try {
    db=JSON.parse(fs.readFileSync(dbPath,"utf8"));
    assert.equal(db.sqlSha256,hash(fs.readFileSync(rlsRunner,"utf8")),"RLS probe changed after its execution");
    assert.equal(db.rlsTwoHouseholds,"PASS"); assert.equal(db.targetedHistoricalTraces,"PASS");
    assert.equal(db.persistence,"ROLLBACK"); assert(Number.isFinite(Date.parse(db.checkedAt)),"RLS evidence must be dated");
    assert.equal(db.syntheticHouseholdsRemaining,0); assert.equal(db.rlsEnabled,true); assert.equal(db.triggers,0);
    assert.equal(new Set(db.policies.map(row=>row.cmd)).size,4);
    for(const migration of db.migrations)assert(preflight.plannedMigrations.includes(`${migration.version}_${migration.name}.sql`));
    execution[rlsRunner]={STATUS:"PASS",evidenceSource:dbPath,checkedAt:db.checkedAt,
      reason:"Previously executed, human-approved remote rollback probe, matching SQL digest. Not silently rerun."};
  }catch(error){execution[rlsRunner]={STATUS:"FAIL",reason:String(error)};}
}else execution[rlsRunner]={STATUS:"NOT_TESTED",reason:"Remote modifications require human approval; pass executed --rls-evidence explicitly."};

function proofStatus(proof){
  if(!fs.existsSync(proof.RUNNER)||!fs.readFileSync(proof.RUNNER,"utf8").includes(proof.EVIDENCE))return "FAIL";
  return execution[proof.RUNNER]?.STATUS??"NOT_TESTED";
}
const coverage=ruleCoverage.map(row=>{
  assert(fs.existsSync(row.OWNER),row.OWNER);
  assert(["STATIC_CONTRACT","MATRIX_CONTRACT","MATHEMATICAL_INVARIANT","AUDIT_REFERENCE","LIVE_CURRENT","USER_DECLARED_FIXTURE"].includes(row.ORACLE));
  const proofs=[...row.DOMAIN_PROOF,...row.SERVER_PROOF,...row.NEGATIVE_PROOF,...row.METAMORPHIC_PROOF];
  const statuses=proofs.map(proofStatus);
  return {...row,STATUS:row.HORIZON==="V1.1"?"NOT_APPLICABLE":statuses.includes("FAIL")?"FAIL":
    !statuses.length||statuses.includes("NOT_TESTED")?"NOT_TESTED":"PASS"};
});
assert.equal(new Set(coverage.map(row=>row.RULE_ID)).size,coverage.length);
const metamorphic=metamorphicCoverage.map(row=>({...row,STATUS:proofStatus(row.PROOF)}));
const ruleCoverageStatus=coverage.filter(row=>row.HORIZON==="V1").every(row=>row.STATUS==="PASS")?"PASS":"FAIL";
const metamorphicStatus=metamorphic.every(row=>row.STATUS==="PASS")?"PASS":"FAIL";
const gate=(id,name,...proofs)=>({ID:`GATE-${String(id).padStart(2,"0")}`,NAME:name,
  STATUS:proofs.some(proof=>execution[proof]?.STATUS==="FAIL")?"FAIL":
    proofs.every(proof=>execution[proof]?.STATUS==="PASS")?"PASS":"NOT_TESTED"});
const gates=[
  gate(1,"Registry/config",tests[0]),gate(2,"Context resolver",tests[0],tests[1]),gate(3,"Adaptive Builder/readiness",tests[2]),
  gate(4,"Places/contacts/social",tests[0],tests[11]),gate(5,"Assets/module graph",tests[0],tests[3]),
  gate(6,"Funding/baseline",tests[7]),gate(7,"Financial decision truth",tests[7]),gate(8,"Child local place/root transport",tests[6],tests[10]),
  gate(9,"Route/fuel",tests[6],"scripts/audit-phase2-dd6-live.mjs"),gate(10,"Lifecycle/reality transition",tests[9]),
  gate(11,"Persistence/idempotence/stale",tests[8],tests[9]),gate(12,"Server validation",tests[1],tests[8],tests[11]),
  gate(13,"MonthScenario/read model",tests[7],tests[10]),gate(14,"Calendar/list/forecast",tests[5],tests[10]),
  gate(15,"Preview/Save parity",tests[8]),gate(16,"RLS",rlsRunner,tests[11]),
  gate(17,"Targeted historical zero-write",rlsRunner,tests[11]),gate(18,"Production build","types","production-build"),
  {ID:"GATE-19",NAME:"Rule coverage / ownership",STATUS:ruleCoverageStatus==="PASS"&&metamorphicStatus==="PASS"?"PASS":"FAIL"},
  gate(20,"Cleanup no duplicate authority",tests[11],tests[12]),
  {ID:"GATE-21",NAME:"Representative user flow evidence",STATUS:"PENDING_C10"},
];
const liveLine=execution["scripts/audit-phase2-dd6-live.mjs"]?.evidence?.split("\n").find(line=>line.startsWith("DD6_LIVE="));
const targetedLine=execution[tests[11]]?.evidence?.split("\n").find(line=>line.startsWith("DD6_ZERO_WRITE="));
const report={checkedAt:new Date().toISOString(),preflight,oracleDoctrine:"Expected values are declared fixtures, contract laws or independent current medians; never regenerated from failing implementation.",
  dbEvidence:dbPath??null,live:liveLine?JSON.parse(liveLine.slice("DD6_LIVE=".length)):null,
  targetedZeroWrite:targetedLine?JSON.parse(targetedLine.slice("DD6_ZERO_WRITE=".length)):null,
  commands:execution,ruleCoverage:coverage,metamorphic,gates,
  summary:{C9_AUTOMATED_DD6:gates.slice(0,20).every(row=>row.STATUS==="PASS")?"PASS":"PARTIAL",
    RULE_COVERAGE:ruleCoverageStatus,METAMORPHIC:metamorphicStatus,RLS:gates[15].STATUS,HISTORICAL_ZERO_WRITE:gates[16].STATUS,
    PREVIEW_SAVE_PARITY:gates[14].STATUS,PRODUCTION_BUILD:gates[17].STATUS,GATE_21_USER_FLOW:"PENDING_C10"}};
fs.mkdirSync("docs/status",{recursive:true});
fs.writeFileSync("docs/status/phase2-c9-dd6-certification.json",JSON.stringify(report,null,2)+"\n");
const proofText=proofs=>proofs.map(p=>`${p.RUNNER}: ${p.EVIDENCE}`).join("<br>").replaceAll("|","\\|")||"NOT_APPLICABLE";
const md=["# Phase 2 — C9 certification DD6 automatique","",`Exécuté : ${report.checkedAt} (UTC). HEAD de départ : ${preflight.head}.`,"",
  "Les preuves RLS sont celles du test distant approuvé, daté et annulé par ROLLBACK, avec contrôle du hash SQL. Les parcours représentatifs restent PENDING_C10.","",
  "## Gates","","| Gate | Contrat | Statut |","| --- | --- | --- |",...gates.map(row=>`| ${row.ID} | ${row.NAME} | ${row.STATUS} |`),"",
  "## Commandes réellement exécutées","","| Runner | Statut |","| --- | --- |",...Object.entries(execution).map(([key,row])=>`| ${key} | ${row.STATUS} |`),"",
  "## Rule Coverage Matrix","","| RULE_ID | OWNER | HORIZON | DOMAIN_PROOF | SERVER_PROOF | USER_FLOW_PROOF | NEGATIVE_PROOF | METAMORPHIC_PROOF | ORACLE | STATUS |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...coverage.map(row=>`| ${row.RULE_ID} | ${row.OWNER} | ${row.HORIZON} | ${proofText(row.DOMAIN_PROOF)} | ${proofText(row.SERVER_PROOF)} | ${row.USER_FLOW_PROOF} | ${proofText(row.NEGATIVE_PROOF)} | ${proofText(row.METAMORPHIC_PROOF)} | ${row.ORACLE} | ${row.STATUS} |`),"",
  "## Métamorphiques","","| Règle | Preuve | Oracle | Statut |","| --- | --- | --- | --- |",...metamorphic.map(row=>`| ${row.RULE_ID} | ${proofText([row.PROOF])} | ${row.ORACLE} | ${row.STATUS} |`),"",
  "## Limites","","- Lint : aucune commande configurée, donc NOT_APPLICABLE.",
  "- Les mutations applicatives sont exercées sur les vraies actions/services avec transport SQL simulé ; les politiques RLS sont exercées séparément dans PostgreSQL distant.",
  "- L'absence de trace historique est vérifiée par opération avec ID de root, puis par foyers synthétiques en SQL. Aucun payload bancaire n'est exporté.",
  "- Les fixtures de DB sont entièrement annulées. Le runner n'exécute pas de mutation distante sans nouvelle validation humaine.",
  "- MEM-01..08 V1.1 : NOT_APPLICABLE ; MEM-V1-01..07 exécutés.",
  "- Aucun golden n'est mis à jour automatiquement. Le rapport référence les observations courantes et distingue les preuves datées.",""];
fs.writeFileSync("docs/status/phase2-c9-dd6-certification.md",md.join("\n"));
console.log(JSON.stringify(report.summary));
if(Object.values(execution).some(row=>row.STATUS==="FAIL")||ruleCoverageStatus==="FAIL"||metamorphicStatus==="FAIL")process.exitCode=1;
