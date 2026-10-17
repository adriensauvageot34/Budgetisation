"use client";
import styles from "./composer.module.css";
/** Transient presentation only. Paging never writes to the Semantic Draft. */
export function BarPageControls({index,count,onChange,label}: {index:number;count:number;onChange:(index:number)=>void;label:string}) {
  if(count<=1)return null;
  return <nav className={styles.barPagination} aria-label={label} data-bar-pagination>
    <button type="button" disabled={index===0} onClick={()=>onChange(index-1)} aria-label={`${label} · précédente`}>←</button>
    <span aria-live="polite">{index+1} / {count}</span>
    <button type="button" disabled={index+1>=count} onClick={()=>onChange(index+1)} aria-label={`${label} · suivante`}>→</button>
  </nav>;
}
