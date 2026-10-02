"use client";
import { useMemo } from "react";
import { usePlannedExpenseInteractions } from "./planned-expense-interactions";
import material from "./month-material.module.css";
import scene from "./planned-scroll-scene.module.css";
import { usePlannedScrollScene } from "./use-planned-scroll-scene";
import { usePlannedContentMotion } from "./use-planned-content-motion";

const sections = [["resources-title", "Ressources"], ["outflows-title", "Charges"], ["planned-expense-title", "Projets"],
  ["timeline-title", "Calendrier"], ["necessary-title", "Quotidien"], ["flexible-title", "Extras"], ["final-projection", "Projection"], ["decision-tools", "Choix"]] as const;

export function MonthSectionNav({ hasProjects }: { hasProjects: boolean }) {
  const interactions = usePlannedExpenseInteractions();
  const available = useMemo(() => sections.filter(([id]) => hasProjects || id !== "planned-expense-title"), [hasProjects]);
  const ids = useMemo(() => available.map(([id]) => id), [available]);
  const { anchor, toolbar, tabs, indicator, active } = usePlannedScrollScene(ids);
  usePlannedContentMotion(toolbar);
  return <>
    <span ref={anchor} className={scene.anchor} aria-hidden="true" />
    <div className={scene.occlusion} aria-hidden="true" />
    <nav ref={toolbar} aria-label="Sections du mois" className={`${material.nav} ${scene.toolbar} sticky z-20 flex items-center justify-between gap-3`}>
      <span className={scene.specular} aria-hidden="true" />
      <div className={scene.tabsViewport}><div ref={tabs} className={scene.tabs}>
        <span ref={indicator} className={scene.indicator} aria-hidden="true" />
        {available.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} className={`${material.tab} rounded-xl px-3 py-2 text-xs font-bold text-slate-600`}>{label}</a>)}
      </div></div>
      <button type="button" onClick={() => interactions?.request({ action: "CREATE" })} className={`${material.clayPrimary} ${scene.cta} shrink-0 px-4 py-3 text-sm font-bold`}>+ Ajouter une dépense</button>
    </nav>
  </>;
}
