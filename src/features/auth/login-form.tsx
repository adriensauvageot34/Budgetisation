"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await createClient().auth.signInWithPassword({
      email,
      password,
    });
    if (result.error) {
      setError("E-mail ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    const requestedPath = searchParams.get("retour");
    const destination =
      requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/";
    router.replace(destination);
    router.refresh();
  }

  return (
    <form className="mt-7 space-y-4" onSubmit={submit}>
      <label className="block">
        <span className="mb-2 block text-sm font-extrabold">E-mail</span>
        <input
          className="field w-full"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-extrabold">Mot de passe</span>
        <input
          className="field w-full"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error ? (
        <p className="rounded-xl bg-[#f7dfda] px-4 py-3 text-sm font-bold text-[#9a463c]">
          {error}
        </p>
      ) : null}
      <button className="button-primary w-full" type="submit" disabled={loading}>
        <LogIn size={17} />
        {loading ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
