import { useEffect, useRef, type ReactNode } from 'react';
import type { AtomicNode, VisualClusterNode } from '@/app/mois-a-venir/composer/presentation/node-types';
import styles from '@/app/mois-a-venir/composer/composer.module.css';

/** Fixture-only comparison. Real children/editors; no semantic or financial operation. */
export function VisualClusterOverlay({node,close,renderChild,palette,trash}:{node:VisualClusterNode;focused?:string|null;close:()=>void;renderChild:(child:AtomicNode)=>ReactNode;palette?:ReactNode;trash?:ReactNode}) {
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{panel.current?.querySelector<HTMLButtonElement>('button')?.focus();},[]);
 return <section ref={panel} className={styles.clusterDialog} style={{position:'relative',inset:'auto',margin:0,width:'100%',maxWidth:'100%',flex:'0 0 auto',maxHeight:'none'}} data-cluster-overlay={node.family} data-fixture-expansion-trial aria-label={`${node.title}, expansion dans le Board`}>
   <header><div><h2>Mes restaurants et repas</h2><p>{node.children.length} objets indépendants</p></div><button type="button" onClick={close}>Refermer le groupe</button></header>
   <div className={styles.clusterChildren}>{node.children.map(child=><div key={child.id} className={styles.clusterChildCell} style={{width:child.width,minHeight:child.height}}>{renderChild(child)}</div>)}</div>{palette}{trash}
 </section>;
}
