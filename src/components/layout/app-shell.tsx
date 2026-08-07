"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartNoAxesCombined,
  CircleUserRound,
  FileUp,
  History,
  Landmark,
  LayoutDashboard,
  Settings2,
  TableProperties,
} from "lucide-react";

const navigation = [
  { href: "/", label: "Accueil", icon: LayoutDashboard },
  { href: "/historique", label: "Historique", icon: History },
  { href: "/analyse", label: "Analyse", icon: ChartNoAxesCombined },
  { href: "/operations", label: "Opérations", icon: TableProperties },
  { href: "/imports", label: "Imports", icon: FileUp },
  { href: "/parametres", label: "Paramètres", icon: Settings2 },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/categorie");
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen border-r border-[var(--color-border)] bg-[#eeeee8] px-4 py-5 md:flex md:flex-col">
        <Link href="/" className="mb-8 flex items-center gap-3 px-2">
          <span className="flex size-10 items-center justify-center rounded-[0.85rem] bg-[var(--color-primary)] text-white">
            <Landmark size={20} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-[1.05rem] font-black tracking-[-0.02em]">
              Budgetisation
            </span>
            <span className="block text-xs text-[var(--color-muted)]">
              Budget du foyer
            </span>
          </span>
        </Link>

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

        <div className="mt-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white/70 p-3">
          <div className="flex items-center gap-2.5">
            <CircleUserRound size={20} className="text-[var(--color-primary)]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">Adrien & Manon</p>
              <p className="text-xs text-[var(--color-muted)]">Données de démonstration</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-15 items-center justify-between border-b border-[var(--color-border)] bg-[color:var(--color-canvas)]/95 px-4 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2 font-black">
            <span className="flex size-8 items-center justify-center rounded-[0.65rem] bg-[var(--color-primary)] text-white">
              <Landmark size={16} />
            </span>
            Budgetisation
          </Link>
          <span className="badge">Démo locale</span>
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
    </div>
  );
}
