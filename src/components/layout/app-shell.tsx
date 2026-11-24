"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Landmark } from "lucide-react";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { useProductRuntime } from "@/components/runtime";
import { JULY_V2_HREF } from "@/domain/phase2/planner/realized-month-entry";
import { MonthPicker } from "@/app/mois-a-venir/month-picker";
import scene from "@/app/mois-a-venir/planned-scroll-scene.module.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const runtime = useProductRuntime();
  const historyV2 = /^\/historique\/\d{4}-\d{2}$/.test(pathname);
  const julyV2 = pathname === JULY_V2_HREF;
  const composerBalance = pathname === "/mois-a-venir/composer/bilan";
  const plannedMonth = pathname === "/mois-a-venir" || julyV2 || composerBalance;
  const composerCalendar = pathname === "/mois-a-venir/composer/calendrier";
  const composer = pathname === "/mois-a-venir/composer";
  const glass = plannedMonth || composerCalendar;

  if (pathname === "/connexion" || pathname === "/acces-refuse" || pathname === "/mentions-places") {
    return children;
  }

  if (pathname === "/recette/bar-favoris") return <main ref={runtime.backgroundRootRef} data-composer-app-shell
    style={{ height: "100dvh", padding: "12px 24px 20px", overflow: "hidden", background: "#fdfcfb" }}>{children}</main>;

  return (
    <div data-planned-shell={glass ? "" : undefined} className={composer ? "grid h-dvh grid-rows-[auto_minmax(0,1fr)]" : glass ? scene.shell : "min-h-screen"}>
      {glass && <div data-planned-background className={scene.background} aria-hidden="true" />}
      <header data-planned-header={plannedMonth ? "" : undefined} className={plannedMonth ? scene.header : "border-b border-[var(--color-border)] bg-white"}>
        <div className="flex items-center gap-3 px-3 py-1.5 sm:px-6">
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <Landmark size={17} aria-hidden />
            </span>
            <span className="sr-only font-bold sm:not-sr-only">Budgetisation</span>
          </div>
          <nav className="mr-auto min-w-0" aria-label="Période de Budgetisation">
            <Suspense fallback={<span aria-hidden className="block h-8 w-28 sm:w-56" />}>
              <MonthPicker />
            </Suspense>
          </nav>
          <SignOutButton compact />
        </div>
      </header>

      <main
        ref={runtime.backgroundRootRef}
        data-composer-app-shell={composer ? "" : undefined}
        className={composer ? "min-h-0 min-w-0 overflow-hidden bg-[#fdfcfb] px-3 pb-4 pt-2 sm:px-6"
          : composerCalendar ? "w-full min-w-0 px-2 py-3 sm:px-5" : historyV2
          ? "py-6"
          : pathname === "/mois-a-venir" || composerBalance
            ? "mx-auto max-w-[1360px] px-[var(--space-page)] py-4 sm:py-6"
            : "mx-auto max-w-6xl px-[var(--space-page)] py-4 sm:py-6"}
      >
        {children}
      </main>
    </div>
  );
}
