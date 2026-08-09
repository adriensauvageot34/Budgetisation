"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  History,
  Landmark,
  LayoutDashboard,
  Settings2,
  Tags,
  TableProperties,
  X,
} from "lucide-react";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { ImportsWorkspace } from "@/features/imports/imports-workspace";
import { openImportEvent } from "@/features/imports/import-trigger";

const navigation = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/historique", label: "Historique", icon: History },
  { href: "/operations", label: "Opérations", icon: TableProperties },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/historique") {
    return pathname.startsWith("/historique") || pathname.startsWith("/categorie");
  }
  return pathname.startsWith(href);
}

function HouseholdMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className={`flex w-full items-center gap-3 rounded-[0.85rem] text-left transition hover:bg-white/60 ${
          compact ? "p-1" : "px-2 py-1.5"
        }`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[0.85rem] bg-[var(--color-primary)] text-white">
          <Landmark size={20} strokeWidth={2.2} />
        </span>
        {!compact ? (
          <span className="min-w-0 flex-1">
            <span className="block text-[1.05rem] font-black tracking-[-0.02em]">
              Budgetisation
            </span>
            <span className="block text-xs text-[var(--color-muted)]">
              Budget du foyer
            </span>
          </span>
        ) : null}
        <ChevronDown
          size={15}
          className={`text-[var(--color-muted)] transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          className={`absolute left-0 top-[calc(100%+0.45rem)] z-50 w-64 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white p-2 shadow-[var(--shadow-md)] ${
            compact ? "max-w-[calc(100vw-2rem)]" : ""
          }`}
          role="menu"
        >
          <div className="mb-1 rounded-xl bg-[var(--color-surface-soft)] px-3 py-2.5">
            <p className="text-xs font-bold text-[var(--color-muted)]">Foyer / profil</p>
            <p className="mt-0.5 font-black">Foyer Budgetisation</p>
          </div>
          <Link
            href="/parametres"
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-[var(--color-surface-soft)]"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <Settings2 size={16} /> Paramètres
          </Link>
          <Link
            href="/parametres#regles-classement"
            className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-[var(--color-surface-soft)]"
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <Tags size={16} /> Règles de classement
          </Link>
          <div className="border-t border-[var(--color-border)] pt-1">
            <SignOutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    const openImport = () => setImportOpen(true);
    window.addEventListener(openImportEvent, openImport);
    return () => window.removeEventListener(openImportEvent, openImport);
  }, []);

  if (pathname === "/connexion" || pathname === "/acces-refuse") {
    return children;
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r border-[var(--color-border)] bg-[#eeeee8] px-4 py-5 md:flex md:flex-col">
        <div className="mb-8">
          <HouseholdMenu />
        </div>

        <nav className="space-y-1" aria-label="Navigation principale">
          {navigation.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center gap-3 rounded-[0.8rem] px-3 text-sm font-bold transition ${
                  active
                    ? "bg-white text-[var(--color-primary-deep)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--color-muted)] hover:bg-white/60 hover:text-[var(--color-ink)]"
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 1.9} />
                {item.label}
              </Link>
            );
          })}
        </nav>

      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-15 items-center border-b border-[var(--color-border)] bg-[color:var(--color-canvas)]/95 px-3 backdrop-blur md:hidden">
          <HouseholdMenu compact />
        </header>

        <main className="mx-auto min-h-screen max-w-[1540px] px-[var(--space-page)] pb-24 pt-6 md:pb-10 md:pt-8">
          {children}
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-18 items-center overflow-x-auto border-t border-[var(--color-border)] bg-white px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Navigation mobile"
      >
        {navigation.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[74px] flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[0.67rem] font-extrabold ${
                active
                  ? "text-[var(--color-primary-deep)]"
                  : "text-[var(--color-faint)]"
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.5 : 1.9} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {importOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[#24322f]/55 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Importer des opérations"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setImportOpen(false);
          }}
        >
          <div className="my-auto max-h-[calc(100vh-1.5rem)] w-full max-w-[1320px] overflow-y-auto rounded-[var(--radius-lg)] bg-[var(--color-canvas)] shadow-2xl sm:max-h-[calc(100vh-3rem)]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-3 sm:px-6">
              <div>
                <p className="eyebrow">Action globale</p>
                <h2 className="text-xl font-black">Importer des opérations</h2>
              </div>
              <button
                type="button"
                className="button-secondary px-3"
                onClick={() => setImportOpen(false)}
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <ImportsWorkspace
                batches={[]}
                embedded
                onNavigate={() => setImportOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

