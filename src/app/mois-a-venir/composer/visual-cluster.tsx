"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { PlannerIcon } from "./planner-icons/planner-icon";
import type { AtomicNode, VisualClusterNode } from "./presentation/node-types";
import styles from "./composer.module.css";

export function VisualClusterCard({ node, open }: { node: VisualClusterNode; open: () => void }) {
  return <button type="button" className={styles.visualCluster} data-visual-cluster={node.family} aria-haspopup="dialog" aria-label={`${node.title}, ${node.children.length} éléments. Ouvrir le groupe`} onClick={open}>
    <div className={styles.clusterHero}><PlannerIcon iconKey={node.iconKey} scale="CLUSTER" /></div>
    <div className={styles.clusterInfo}><h3>{node.title}</h3><strong>{node.children.length} éléments</strong><span>Ouvrir les objets</span></div>
    <div className={styles.clusterMiniatures} aria-hidden="true">{node.children.slice(0, 4).map(child => <span key={child.id}>
      <PlannerIcon iconKey={child.iconKey} identityRef={child.id} scale="SATELLITE" />
    </span>)}{node.children.length > 4 && <small>+{node.children.length - 4}</small>}</div>
  </button>;
}

export function VisualClusterOverlay({ node, close, renderChild, palette, trash }: { node: VisualClusterNode; close: () => void; renderChild: (child: AtomicNode) => ReactNode; palette?: ReactNode; trash?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => { if (element?.open) element.close(); }; }, []);
  return <dialog ref={dialog} className={styles.clusterDialog} data-cluster-overlay={node.family} aria-label={`${node.title}, ${node.children.length} éléments`}
    onClose={close} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <header><div><span className={styles.clusterEyebrow}>Groupe visuel</span><h2>{node.title}</h2><p>{node.children.length} objets indépendants · montants dans chaque objet</p></div>
      <button type="button" className={styles.iconButton} aria-label={`Fermer ${node.title}`} onClick={close}><X size={20} /></button></header>
    <div className={styles.clusterChildren}>{node.children.map(child => <div key={child.id} className={styles.clusterChildCell} style={{ width: child.width, minHeight: child.height }}>{renderChild(child)}</div>)}</div>
    {palette}
    {trash}
  </dialog>;
}
