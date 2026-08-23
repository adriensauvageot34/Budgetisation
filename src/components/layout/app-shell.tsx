"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Landmark } from "lucide-react";
import { SignOutButton } from "@/features/auth/sign-out-button";

const modules = [
  { href: "/historique", label: "Historique" },
  { href: "/operations", label: "Opérations" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/connexion" || pathname === "/acces-refuse") {
    return children;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-[var(--space-page)] py-4">
          <Link href="/historique" className="mr-auto flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
              <Landmark size={20} />
            </span>
            <span>
              <span className="block font-black">Budgetisation V2</span>
              <span className="block text-xs text-[var(--color-muted)]">
                Historique · Analyse · Opérations
              </span>
            </span>
          </Link>

          <nav className="flex flex-wrap gap-1" aria-label="Navigation principale">
            {modules.map((module) => {
              const active =
                pathname.startsWith(module.href);
              return (
                <Link
                  key={module.href}
                  href={module.href}
                  className={`rounded-xl px-3 py-2 text-sm font-bold transition ${
                    active
                      ? "bg-[var(--color-surface-soft)] text-[var(--color-primary-deep)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)]"
                  }`}
                >
                  {module.label}
                </Link>
              );
            })}
          </nav>

          <Link href="/diagnostic" className="button-ghost text-xs">Diagnostic</Link>

          <SignOutButton compact />
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-73px)] max-w-6xl px-[var(--space-page)] py-8">
        {children}
      </main>
    </div>
  );
}
