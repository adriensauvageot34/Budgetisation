// Browser fixture only. Numeric timings and synthetic digests; never imported by product code.
type Probe = { spans: Record<string,{calls:number;ms:number}>; stages: unknown[]; renders: unknown[];
  requests: unknown[]; commits: unknown[]; phase: string; completed:boolean; failure:string|null; lastIntent:number };
export const probe:Probe={spans:{},stages:[],renders:[],requests:[],commits:[],phase:'initial',completed:false,failure:null,lastIntent:0};
export function clientSpan(label:string){const at=performance.now();return()=>{const row=probe.spans[label]??={calls:0,ms:0};row.calls++;row.ms+=performance.now()-at;};}
export function publish(){document.querySelector('[data-p2-metrics]')?.setAttribute('data-result',JSON.stringify(probe));}
export function rendered(_id:string,_phase:string,actualDuration:number){probe.renders.push({phase:probe.phase,at:performance.now(),ms:actualDuration});}
export function commit(digest:string,proof:string,status:string,save:string,cards:number){
  probe.commits.push({phase:probe.phase,at:performance.now(),digest,proof,status,save,cards});publish();
}
