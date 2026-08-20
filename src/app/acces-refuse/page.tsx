import { ShieldAlert } from "lucide-react";
import { SignOutButton } from "@/features/auth/sign-out-button";

export const metadata = { title: "Accès refusé" };

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="card w-full max-w-lg p-6 text-center sm:p-8">
        <ShieldAlert
          size={34}
          className="mx-auto text-[var(--color-accent)]"
        />
        <h1 className="mt-4 text-2xl font-black">Accès au foyer non configuré</h1>
        <p className="mt-3 leading-6 text-[var(--color-muted)]">
          Votre compte Auth est valide, mais il n’est pas encore rattaché au
          foyer V2 autorisé. Le mapping Auth → Household doit être vérifié
          dans Supabase, sans contourner la RLS.
        </p>
        <div className="mx-auto mt-5 max-w-56">
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
