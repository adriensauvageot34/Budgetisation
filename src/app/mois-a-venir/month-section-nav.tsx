"use client";
import { useEffect, useState } from "react";
const sections = [["resources-title", "Ressources"], ["outflows-title", "Charges"], ["planned-expense-title", "Projets"],
  ["timeline-title", "Calendrier"], ["necessary-title", "Quotidien"], ["flexible-title", "Extras"], ["final-projection", "Projection"], ["decision-tools", "Choix"]] as const;
export function MonthSectionNav() {
  const [active, setActive] = useState<string>(sections[0][0]);
  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top); else visible.delete(entry.target.id);
      const first = [...visible].sort((a, b) => a[1] - b[1])[0]; if (first) setActive(first[0]);
    }, { rootMargin: "-90px 0px -45% 0px" });
    for (const [id] of sections) { const node = document.getElementById(id); if (node) observer.observe(node); }
    return () => observer.disconnect();
  }, []);
  return <nav aria-label="Sections du mois" className="sticky top-2 z-20 flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">{sections.map(([id, label]) => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} className={`rounded-xl px-3 py-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-emerald-700 ${active === id ? "bg-emerald-100 text-emerald-950" : "text-slate-600 hover:bg-slate-50"}`}>{label}</a>)}</nav>;
}
