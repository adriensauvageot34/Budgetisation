import "server-only";

export const FORECAST_MODEL_VERSION="month-asof@v1/purchase@v1/coverage@v1/opportunity@v1";
export const FORECAST_POLICY = Object.freeze({ recentWeight:3, previousWeight:1, shiftWeight:6,
  lowerFactor:.8, higherFactor:1.2, minimumMonths:3, calibrationMonths:4 });
export function weightedQuantile(values: readonly number[], weights: readonly number[], quantile: number): number {
  if (!values.length) return 0;
  const sorted=values.map((v,i)=>({v,w:weights[i]??1})).sort((a,b)=>a.v-b.v);
  const total=sorted.reduce((n,r)=>n+r.w,0), target=quantile*total;
  let sum=0;
  for(const row of sorted){sum+=row.w;if(sum>=target)return row.v;}
  return sorted.at(-1)!.v;
}
export function recentSeries(values: readonly number[]) {
  const recent=values.slice(-3), older=values.slice(0,-3);
  const median=(v:readonly number[])=>weightedQuantile(v,v.map(()=>1),.5);
  const r=median(recent), o=median(older);
  // A sustained change needs three recent months on the same side of the old
  // interquartile range, and a material separation from its median.
  const low=weightedQuantile(older,older.map(()=>1),.25),high=weightedQuantile(older,older.map(()=>1),.75);
  const shift=recent.length===3 && older.length>=3 && Math.abs(r-o)>Math.max(1,Math.abs(o)*.25)
    && (recent.every(v=>v<low) || recent.every(v=>v>high)) ? r<o ? "DOWN" as const : "UP" as const : null;
  const weights=values.map((_,i)=>i>=values.length-3 ? shift ? FORECAST_POLICY.shiftWeight : FORECAST_POLICY.recentWeight : FORECAST_POLICY.previousWeight);
  return {weights,shift};
}
export type OccurrenceDistribution=Readonly<{zero:number;one:number;two:number;threePlus:number}>;
/** Empirical mixture retains zero months; binomial thinning removes elapsed or
 * occupied opportunities. It is deterministic and never generates extra trials. */
export function occurrenceDistribution(counts:readonly number[], weights:readonly number[], remainingFraction:number,
  absorbed=0):OccurrenceDistribution {
  const bins=[0,0,0,0], p=Math.max(0,Math.min(1,remainingFraction)), weight=weights.reduce((a,b)=>a+b,0);
  if(!counts.length||!weight)return{zero:1,one:0,two:0,threePlus:0};
  counts.forEach((n,i)=>{
    const count=Math.max(0,Math.floor(n)), w=(weights[i]??1)/weight;
    if(p===1){bins[Math.min(3,Math.max(0,count-absorbed))]!+=w;return;}
    if(p===0){bins[0]!+=w;return;}
    let probability=(1-p)**count;
    for(let k=0;k<=count;k++){
      bins[Math.min(3,Math.max(0,k-absorbed))]!+=w*probability;
      probability=probability*(count-k)/(k+1)*p/(1-p);
    }
  });
  return {zero:bins[0]!,one:bins[1]!,two:bins[2]!,threePlus:Math.max(0,1-bins[0]!-bins[1]!-bins[2]!)};
}
export const forecastHorizon=(asOf:string,month:string)=>asOf<`${month}-08`?"START":asOf<`${month}-22`?"MID":"END";
