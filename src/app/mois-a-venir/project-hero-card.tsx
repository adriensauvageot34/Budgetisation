"use client";
import type { ReactNode } from "react";
import type { PlannedExpenseCard } from "./planned-expenses-projection";
import { compatibleProjectVisual, projectVisualPlaceId } from "@/domain/phase2/planned-visual";
import { intentForDraft } from "@/domain/phase2/planned-ux";
import { plannedExpenseTemporalSummary } from "@/domain/phase2/planned-dates";
import { calendarBudgetLabel, calendarStateLabel } from "./calendar-presentation";
import { RestaurantPhotoBackground } from "./restaurant-photo-background";
import { BuilderIllustration } from "./builder-illustrations";
import { ChevronDown } from "lucide-react";
import material from "./month-material.module.css";

/** Shared presentation. One saved root owns the costs and all lifecycle actions passed as children. */
export function ProjectHeroCard({ item, children }: { item: PlannedExpenseCard; children: ReactNode }) {
  const intent = intentForDraft(item), visual = compatibleProjectVisual(item);
  return <li data-project-card={item.id} data-month-motion-item="project" className={`${material.projectCard} min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm`}>
    {intent === "restaurant" ? <RestaurantPhotoBackground placeId={projectVisualPlaceId(item)} selectedIndex={visual?.selectedIndex} />
      : <div data-project-hero aria-hidden="true" className="relative aspect-video overflow-hidden bg-slate-100"><div data-project-image className="absolute inset-0"><BuilderIllustration semanticKey={`intent:${intent}`} /></div></div>}
    <details id={`project-${item.id}`} className="group">
      <summary className="relative -mt-20 min-h-20 cursor-pointer list-none bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-3 pt-4 text-white focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3"><h3 className="min-w-0 flex-1 break-words text-base font-bold leading-snug">{item.title}</h3><ChevronDown aria-hidden="true" size={16} className={material.projectChevron} /></div>
        <div className="mt-1 flex items-start justify-between gap-3 text-sm"><div className="min-w-0 text-white/85">
          <span className={item.status === "DECLARED_REALIZED" ? "text-emerald-200" : item.needsRealityConfirmation ? "text-amber-200" : ""}>{calendarStateLabel({ expense: item, nature: item.status === "DECLARED_REALIZED" ? "DECLARED_REALIZED" : "PLANNED_EXPENSE" })}</span>
          <span> · {plannedExpenseTemporalSummary(item)[0]}</span>
        </div><strong className="shrink-0 whitespace-nowrap text-base tabular-nums">{calendarBudgetLabel({ expense: item, amount: item.grossCost })}</strong></div>
      </summary>
      <div className="bg-white px-4 pb-4 pt-3">{children}</div>
    </details>
  </li>;
}
