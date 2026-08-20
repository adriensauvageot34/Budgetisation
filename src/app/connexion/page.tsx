import { Suspense } from "react";
import { Landmark } from "lucide-react";
import { LoginForm } from "@/features/auth/login-form";

export const metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="card w-full max-w-md p-6 sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white">
          <Landmark size={23} />
        </span>
        <h1 className="mt-5 text-3xl font-black tracking-[-0.04em]">
          Budgetisation V2
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Connexion au bootstrap technique V2.
        </p>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
