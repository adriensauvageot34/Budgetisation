"use client";
import { useEffect, useState } from "react";
import { usePlannedExpenseInteractions } from "./planned-expense-interactions";
import material from "./month-material.module.css";
import scene from "./planned-scroll-scene.module.css";
import { usePlannedScrollScene } from "./use-planned-scroll-scene";
const sections = [["resources-title", "Ressources"], ["outflows-title", "Charges"], ["planned-expense-title", "Projets"],
  ["timeline-title", "Calendrier"], ["necessary-title", "Quotidien"], ["flexible-title", "Extras"], ["final-projection", "Projection"], ["decision-tools", "Choix"]] as const;
export function MonthSectionNav({ hasProjects }: { hasProjects: boolean }) {
  const interactions = usePlannedExpenseInteractions();
  const { anchor, toolbar } = usePlannedScrollScene();
  const [active, setActive] = useState<string>(sections[0][0]);
  useEffect(() => {
    let observer: IntersectionObserver | undefined;
    const observe = () => {
      observer?.disconnect();
      const visible = new Map<string, number>();
      const offset = (toolbar.current?.offsetHeight ?? 64) + 28;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top); else visible.delete(entry.target.id);
        const first = [...visible].sort((a, b) => a[1] - b[1])[0]; if (first) setActive(first[0]);
      }, { rootMargin: `-${offset}px 0px -45% 0px` });
      for (const [id] of sections) { const node = document.getElementById(id); if (node) observer.observe(node); }
    };
    const resize = new ResizeObserver(observe);
    if (toolbar.current) resize.observe(toolbar.current);
    observe();
    return () => { observer?.disconnect(); resize.disconnect(); };
  }, [hasProjects, toolbar]);
  return <><span ref={anchor} className={scene.anchor} aria-hidden="true" /><div className={scene.occlusion} aria-hidden="true" />
    <nav ref={toolbar} aria-label="Sections du mois" className={`${material.nav} ${scene.toolbar} sticky z-20 flex items-center justify-between gap-3`}>
    <span className={scene.specular} aria-hidden="true" />
    <div className={`${scene.tabs} flex`}>{sections.filter(([id]) => hasProjects || id !== "planned-expense-title").map(([id, label]) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} className={`${material.tab} rounded-xl px-3 py-2 text-xs font-bold text-slate-600`}>{label}</a>)}</div>
    <button type="button" onClick={() => interactions?.request({ action: "CREATE" })} className={`${material.clayPrimary} ${scene.cta} shrink-0 px-4 py-3 text-sm font-bold`}>+ Ajouter une dépense</button>
  </nav></>;
}
