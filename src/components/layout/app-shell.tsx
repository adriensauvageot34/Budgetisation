"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChartNoAxesCombined, ChevronDown, Landmark, WalletCards } from "lucide-react";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { useProductRuntime } from "@/components/runtime";
import { JULY_COMPOSER_MONTH, JULY_V2_HREF } from "@/domain/phase2/planner/realized-month-entry";
import { MonthPicker } from "@/app/mois-a-venir/month-picker";
import { globalAnalysisEntryHref, globalAnalysisHref, isWorkspaceMonth, workspacePeriodHref } from "@/app/mois-a-venir/month-entry";
import { ComposerMonthNavigationContext, type ComposerMonthNavigationGuard } from "@/app/mois-a-venir/composer/month-navigation-guard";
import scene from "@/app/mois-a-venir/planned-scroll-scene.module.css";
import { AppToolbarTarget } from "./app-toolbar";
import styles from "./app-shell.module.css";

function AnalysisNavigation({ pathname, returning = false, onNavigate }: {
  readonly pathname: string;
  readonly returning?: boolean;
  readonly onNavigate?: (event: { preventDefault(): void }, href: string) => void;
}) {
  const search = useSearchParams();
  const month = pathname === JULY_V2_HREF ? JULY_COMPOSER_MONTH : search.get("month") ?? "";
  const href = returning
    ? isWorkspaceMonth(month) ? workspacePeriodHref(month, globalAnalysisHref) : "/mois-a-venir"
    : globalAnalysisEntryHref(month);
  return <Link href={href} prefetch={false} className={returning ? styles.returnToMonths : undefined}
    aria-current={!returning && pathname === globalAnalysisHref ? "page" : undefined}
    onNavigate={onNavigate ? event => onNavigate(event, href) : undefined}>
    {returning ? "Revenir aux mois" : <><ChartNoAxesCombined size={17} aria-hidden /> Analyse globale</>}
  </Link>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { backgroundRootRef } = useProductRuntime();
  const setBackgroundRoot = useCallback((element: HTMLElement | null) => {
    backgroundRootRef.current = element;
  }, [backgroundRootRef]);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  const monthNavigationGuard = useRef<ComposerMonthNavigationGuard | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);
  const [menuNotice, setMenuNotice] = useState<string | null>(null);
  const historyV2 = /^\/historique\/\d{4}-\d{2}$/.test(pathname);
  const julyV2 = pathname === JULY_V2_HREF;
  const composerBalance = pathname === "/mois-a-venir/composer/bilan";
  const plannedMonth = pathname === "/mois-a-venir" || julyV2 || composerBalance;
  const composerCalendar = pathname === "/mois-a-venir/composer/calendrier";
  const composer = pathname === "/mois-a-venir/composer";
  const globalAnalysis = pathname === globalAnalysisHref;
  const cagnottes = pathname === "/cagnottes";
  const glass = plannedMonth;
  const compactWorkspace = composer || composerCalendar || glass;

  function navigateFromMenu(event: { preventDefault(): void }, href: string) {
    if (composer && monthNavigationGuard.current) {
      event.preventDefault();
      setMenuNotice(monthNavigationGuard.current(() => {
        if (menu.current) menu.current.open = false;
        router.push(href);
      }));
    } else if (menu.current) menu.current.open = false;
  }

  if (pathname === "/connexion" || pathname === "/acces-refuse" || pathname === "/mentions-places") {
    return children;
  }

  if (pathname === "/recette/bar-favoris") return <main ref={setBackgroundRoot} data-composer-app-shell
    style={{ height: "100dvh", padding: "12px 24px 20px", overflow: "hidden", background: "#fdfcfb" }}>{children}</main>;

  return <ComposerMonthNavigationContext.Provider value={monthNavigationGuard}>
    <div ref={compactWorkspace ? setBackgroundRoot : undefined} data-planned-shell={glass ? "" : undefined}
      className={composer ? "grid h-dvh grid-rows-[auto_minmax(0,1fr)]" : glass ? `${scene.shell}${composerBalance ? ` ${styles.balanceShell}` : ""}`
        : globalAnalysis ? `${styles.clayShell} ${styles.globalShell}`
          : cagnottes ? styles.clayShell
          : composerCalendar ? `${styles.clayShell} ${styles.calendarShell}` : "min-h-screen"}>
      {glass && <div data-planned-background className={scene.background} aria-hidden="true" />}
      <header data-planned-header={plannedMonth ? "" : undefined} className={plannedMonth ? scene.header : "border-b border-[var(--color-border)] bg-white"}>
        <div className={styles.bar} data-global-header={globalAnalysis ? "" : undefined}>
          <details ref={menu} className={styles.logoMenu} onToggle={event => {
            if (!event.currentTarget.open) setMenuNotice(null);
          }} onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
          }} onKeyDown={event => {
            if (event.key !== "Escape" || !event.currentTarget.open) return;
            event.stopPropagation();
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }}>
          <summary className={styles.logoButton} aria-label="Menu Budgetisation">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
              <Landmark size={17} aria-hidden />
            </span>
            <span className="sr-only font-bold sm:not-sr-only">Budgetisation</span>
            <ChevronDown size={13} aria-hidden />
          </summary>
          <nav className={styles.logoDropdown} aria-label="Centre de contrôle">
            <Link href="/cagnottes" prefetch={false} aria-current={cagnottes ? "page" : undefined}
              onNavigate={event => navigateFromMenu(event, "/cagnottes")}><WalletCards size={17} aria-hidden /> Cagnottes</Link>
            <Suspense fallback={<Link href={globalAnalysisHref} onNavigate={event => navigateFromMenu(event, globalAnalysisHref)}><ChartNoAxesCombined size={17} aria-hidden /> Analyse globale</Link>}>
              <AnalysisNavigation pathname={pathname} onNavigate={navigateFromMenu} />
            </Suspense>
            <div className={styles.menuAccount}><SignOutButton /></div>
            {menuNotice && <p role="status">{menuNotice}</p>}
          </nav>
          </details>
          {!globalAnalysis && <nav className={styles.period} aria-label="Période de Budgetisation">
            <Suspense fallback={<span aria-hidden className="block h-8 w-28 sm:w-56" />}>
              <MonthPicker />
            </Suspense>
          </nav>}
          <div ref={setToolbarTarget} className={styles.toolbar} data-app-toolbar />
          {globalAnalysis && <Suspense fallback={<Link href="/mois-a-venir" className={styles.returnToMonths}>Revenir aux mois</Link>}>
            <AnalysisNavigation pathname={pathname} returning />
          </Suspense>}
        </div>
      </header>

      <main
        ref={compactWorkspace ? undefined : setBackgroundRoot}
        data-composer-app-shell={composer ? "" : undefined}
        className={composer ? "min-h-0 min-w-0 overflow-hidden bg-[#fdfcfb] px-3 pb-4 pt-2 sm:px-6"
          : cagnottes ? "min-w-0 px-4 py-4 sm:px-7"
          : globalAnalysis ? styles.globalMain : composerCalendar ? styles.calendarMain : composerBalance ? styles.balanceMain : historyV2
          ? "py-6"
          : pathname === "/mois-a-venir"
            ? "mx-auto max-w-[1360px] px-[var(--space-page)] py-4 sm:py-6"
            : "mx-auto max-w-6xl px-[var(--space-page)] py-4 sm:py-6"}
      >
        <AppToolbarTarget.Provider value={toolbarTarget}>{children}</AppToolbarTarget.Provider>
      </main>
    </div>
  </ComposerMonthNavigationContext.Provider>;
}
