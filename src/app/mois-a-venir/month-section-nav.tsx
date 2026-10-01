"use client";
import { useEffect, useState } from "react";
import { usePlannedExpenseInteractions } from "./planned-expense-interactions";
import material from "./month-material.module.css";
const sections = [["resources-title", "Ressources"], ["outflows-title", "Charges"], ["planned-expense-title", "Projets"],
  ["timeline-title", "Calendrier"], ["necessary-title", "Quotidien"], ["flexible-title", "Extras"], ["final-projection", "Projection"], ["decision-tools", "Choix"]] as const;
export function MonthSectionNav({ hasProjects }: { hasProjects: boolean }) {
  const interactions = usePlannedExpenseInteractions();
  const [active, setActive] = useState<string>(sections[0][0]);
  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top); else visible.delete(entry.target.id);
      const first = [...visible].sort((a, b) => a[1] - b[1])[0]; if (first) setActive(first[0]);
    }, { rootMargin: "-90px 0px -45% 0px" });
    for (const [id] of sections) { const node = document.getElementById(id); if (node) observer.observe(node); }
    return () => observer.disconnect();
  }, [hasProjects]);
  return <nav aria-label="Sections du mois" className={`${material.nav} sticky top-2 z-20 flex items-center justify-between gap-3`}>
    <div className="flex gap-1">{sections.filter(([id]) => hasProjects || id !== "planned-expense-title").map(([id, label]) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} className={`${material.tab} rounded-xl px-3 py-2 text-xs font-bold text-slate-600`}>{label}</a>)}</div>
    <button type="button" onClick={() => interactions?.request({ action: "CREATE" })} className={`${material.clayPrimary} shrink-0 px-4 py-3 text-sm font-bold`}>+ Ajouter une dépense</button>
  </nav>;
}
