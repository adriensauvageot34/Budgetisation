// Read-only audit of published/canonical evidence. No financial or historical write.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { require } from "./lib/phase2-ts-loader.mjs";
const { readMonthPredictionEvidence } = require("@/server/phase2/month-prediction-evidence.ts");
const { projectCategoryObservedHistory } = require("@/server/phase2/month-category-history.ts");
const { MONTH_CATEGORY_CAPABILITIES } = require("@/domain/phase2/month-choice-contract.ts");
const { planningDate } = require("@/server/phase2/planning-date.ts");
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const {data:households, error} = await client.from("households").select("household_id").limit(2);
if(error) throw error;
if(households?.length !== 1) throw new Error("Select an explicit household scope before this audit");
const data = households[0];
const month = "2026-10", asOf = planningDate();
const evidence = await readMonthPredictionEvidence(client, data.household_id, month);
const {data:batches,error:batchError}=await client.from("import_batches").select("source_system,status,coverage_status,period_start,period_end").eq("household_id",data.household_id);
if(batchError) throw batchError;
const importProof = Object.fromEntries(["BANK","SWILE","EDENRED","MOBILITY"].map(source=>[source,(batches??[]).filter(row=>row.source_system===source).map(row=>({status:row.status,coverageStatus:row.coverage_status,start:row.period_start,end:row.period_end}))]));
const report = {importProof,asOf, targetMonth:month, writes:0, sourceCoverage:evidence.completeMonthsBySource,
  categories:Object.fromEntries(Object.entries(MONTH_CATEGORY_CAPABILITIES).map(([key,cap])=>[key,{label:cap.label,...projectCategoryObservedHistory(key,evidence,[],asOf,month)}]))};
const destination = process.argv[2];
if(destination) fs.writeFileSync(destination, JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
