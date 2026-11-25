"use client";

import { Suspense, useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { Landmark } from "lucide-react";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { useProductRuntime } from "@/components/runtime";
import { JULY_V2_HREF } from "@/domain/phase2/planner/realized-month-entry";
import { MonthPicker } from "@/app/mois-a-venir/month-picker";
import scene from "@/app/mois-a-venir/planned-scroll-scene.module.css";
import { AppToolbarTarget } from "./app-toolbar";
import styles from "./app-shell.module.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { backgroundRootRef } = useProductRuntime();
  const setBackgroundRoot = useCallback((element: HTMLElement | null) => {
    backgroundRootRef.current = element;
  }, [backgroundRootRef]);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  const historyV2 = /^\/historique\/\d{4}-\d{2}$/.test(pathname);
  const julyV2 = pathname === JULY_V2_HREF;
  const composerBalance = pathname === "/mois-a-venir/composer/bilan";
  const plannedMonth = pathname === "/mois-a-venir" || julyV2 || composerBalance;
  const composerCalendar = pathname === "/mois-a-venir/composer/calendrier";
  const composer = pathname === "/mois-a-venir/composer";
  const globalAnalysis = pathname === "/analyse-globale";
  const glass = plannedMonth;
  const compactWorkspace = composer || composerCalendar || glass;

  if (pathname === "/connexion" || pathname === "/acces-refuse" || pathname === "/mentions-places") {
    return children;
  }

  if (pathname === "/recette/bar-favoris") return <main ref={setBackgroundRoot} data-composer-app-shell
    style={{ height: "100dvh", padding: "12px 24px 20px", overflow: "hidden", background: "#fdfcfb" }}>{children}</main>;

  return (
    <div ref={compactWorkspace ? setBackgroundRoot : undefined} data-planned-shell={glass ? "" : undefined}
      className={composer ? "grid h-dvh grid-rows-[auto_minmax(0,1fr)]" : glass ? scene.shell
        : globalAnalysis ? `${styles.clayShell} ${styles.globalShell}`
          : composerCalendar ? `${styles.clayShell} ${styles.calendarShell}` : "min-h-screen"}>
      {glass && <div data-planned-background className={scene.background} aria-hidden="true" />}
      <header data-planned-header={plannedMonth ? "" : undefined} className={plannedMonth ? scene.header : "border-b border-[var(--color-border)] bg-white"}>
        <div className={styles.bar}>
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <Landmark size={17} aria-hidden />
            </span>
            <span className="sr-only font-bold sm:not-sr-only">Budgetisation</span>
          </div>
          <nav className={styles.period} aria-label="Période de Budgetisation">
            <Suspense fallback={<span aria-hidden className="block h-8 w-28 sm:w-56" />}>
              <MonthPicker />
            </Suspense>
          </nav>
          <div ref={setToolbarTarget} className={styles.toolbar} data-app-toolbar />
          <div className={styles.account}><SignOutButton compact /></div>
        </div>
      </header>

      <main
        ref={compactWorkspace ? undefined : setBackgroundRoot}
        data-composer-app-shell={composer ? "" : undefined}
        className={composer ? "min-h-0 min-w-0 overflow-hidden bg-[#fdfcfb] px-3 pb-4 pt-2 sm:px-6"
          : globalAnalysis ? styles.globalMain : composerCalendar ? styles.calendarMain : historyV2
          ? "py-6"
          : pathname === "/mois-a-venir" || composerBalance
            ? "mx-auto max-w-[1360px] px-[var(--space-page)] py-4 sm:py-6"
            : "mx-auto max-w-6xl px-[var(--space-page)] py-4 sm:py-6"}
      >
        <AppToolbarTarget.Provider value={toolbarTarget}>{children}</AppToolbarTarget.Provider>
      </main>
    </div>
  );
}
