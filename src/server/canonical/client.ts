import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CanonicalConfigurationError } from "./errors";

export type CanonicalReadClient = SupabaseClient;

function getCanonicalReadConfig(): {
  readonly url: string;
  readonly secretKey: string;
} {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url) {
    throw new CanonicalConfigurationError(
      "SUPABASE_URL est requise côté serveur pour les lectures canoniques.",
    );
  }
  if (!secretKey) {
    throw new CanonicalConfigurationError(
      "SUPABASE_SECRET_KEY est requise dans le contexte serveur autorisé.",
    );
  }
  return { url, secretKey };
}

export function createCanonicalReadClient(): CanonicalReadClient {
  const { url, secretKey } = getCanonicalReadConfig();
  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
