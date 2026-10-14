import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { ActivityHistoryTrace } from "./activity-history-artifact";
type RequestMetric = { resource:string;method:string;ms:number;bytes:number;status:number;timeout:boolean };
type Observation = {start:number;requests:RequestMetric[];pending:Promise<void>[];spans:{label:string;ms:number}[];history:Parameters<ActivityHistoryTrace>[0][];blockedWrites:number};
const key=Symbol.for("budgetisation.snap.real.observation");
const global=globalThis as typeof globalThis & {[key]?:AsyncLocalStorage<Observation>};
const contexts=global[key]??=new AsyncLocalStorage<Observation>();
export const snapshotObservationEnabled=()=>process.env.COMPOSER_SNAP_METRICS_ENABLED==="1";
export const snapshotBenchmarkReadOnly=()=>process.env.VERCEL_ENV==="preview"&&process.env.COMPOSER_SNAP_BENCHMARK_READ_ONLY==="1";
const readableRPC=new Set(["inspect_planner_activity_history_v1","inspect_planner_activity_history_trusted_v1","registered_planner_activity_history_v1"]);
const fetchWithMarker=globalThis.fetch as typeof fetch & {snapReal?:boolean};
if(snapshotObservationEnabled()&&!fetchWithMarker.snapReal){
 const original=globalThis.fetch;
 const wrapped:typeof fetch=async(input,init)=>{
  const context=contexts.getStore();if(!context)return original(input,init);
  const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
  const method=(init?.method??(input instanceof Request?input.method:"GET")).toUpperCase();
  const rest=url.pathname.startsWith("/rest/v1/"),rpc=url.pathname.startsWith("/rest/v1/rpc/");
  const resource=rest?url.pathname.slice(9).replace(/[^a-zA-Z0-9_/]/g,""):url.pathname.startsWith("/auth/")?"auth":"other";
  if(snapshotBenchmarkReadOnly()&&rest&&method!=="GET"&&method!=="HEAD"&&!(rpc&&readableRPC.has(resource.slice(4)))){
   context.blockedWrites++;throw new TypeError("SNAP_BENCHMARK_WRITE_REFUSED");}
  const at=performance.now();
  try{
   const response=await original(input,init),metric:RequestMetric={resource,method,ms:performance.now()-at,bytes:0,status:response.status,timeout:false};
   if(context.requests.length<1000){context.requests.push(metric);context.pending.push(response.clone().arrayBuffer().then(bytes=>{
    metric.bytes=bytes.byteLength;if(!response.ok){try{metric.timeout=JSON.parse(new TextDecoder().decode(bytes)).code==="57014";}catch{}}
   },()=>undefined));}return response;
  }catch(error){if(context.requests.length<1000)context.requests.push({resource,method,ms:performance.now()-at,bytes:0,status:0,timeout:false});throw error;}
 };
 (wrapped as typeof fetch & {snapReal?:boolean}).snapReal=true;globalThis.fetch=wrapped;
}
export const snapshotHistoryTrace:ActivityHistoryTrace=event=>{const context=contexts.getStore();if(context&&context.history.length<1000)context.history.push(event);};
export function snapshotSpan(label:string){const context=contexts.getStore();if(!context)return ()=>undefined;const at=performance.now();return ()=>{if(context.spans.length<1000)context.spans.push({label,ms:performance.now()-at});};}
export async function observeSnapshot<T>(run:()=>Promise<T>){
 if(!snapshotObservationEnabled())return {value:await run(),metrics:null};
 const context:Observation={start:performance.now(),requests:[],pending:[],spans:[],history:[],blockedWrites:0};
 return contexts.run(context,async()=>{
  const value=await run(),serverMs=performance.now()-context.start;await Promise.allSettled(context.pending);
  return {value,metrics:{version:"snap-real@1",variant:process.env.COMPOSER_P14_SNAP1_ACTIVITY_HISTORY==="1"?"ON":"OFF",
   region:process.env.VERCEL_REGION??"unknown",serverMs,spans:context.spans,history:context.history,requests:context.requests,blockedWrites:context.blockedWrites}};
 });
}
