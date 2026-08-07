"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut({ scope: "local" });
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className={compact ? "button-secondary px-3" : "button-secondary mt-3 w-full"}
      title="Se déconnecter"
    >
      <LogOut size={16} />
      {compact ? <span className="sr-only">Se déconnecter</span> : "Se déconnecter"}
    </button>
  );
}
