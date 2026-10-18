"use client";
import styles from "./composer.module.css";
/** Transient presentation only. Paging never writes to the Semantic Draft. */
export function BarPageControls({index,count,onChange,label}: {index:number;count:number;onChange:(index:number)=>void;label:string}) {
  if(count<=1)return null;
  const turn=(event:React.MouseEvent<HTMLButtonElement>,next:number)=>{
    const button=event?.currentTarget,nav=button?.closest("nav");onChange(next);
    requestAnimationFrame(()=>{if(button?.disabled)nav?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({preventScroll:true});});
  };
  return <nav className={styles.barPagination} aria-label={label} data-bar-pagination>
    <button type="button" disabled={index===0} onClick={event=>turn(event,index-1)} aria-label={`${label} · précédente`}>←</button>
    <span aria-live="polite">{index+1} / {count}</span>
    <button type="button" disabled={index+1>=count} onClick={event=>turn(event,index+1)} aria-label={`${label} · suivante`}>→</button>
  </nav>;
}
