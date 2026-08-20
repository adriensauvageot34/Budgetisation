import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  BootstrapAuthenticationRequiredError,
  BootstrapDataError,
} from "@/server/bootstrap/errors";

export async function getAuthenticatedBootstrapClient(): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new BootstrapDataError("Impossible de vérifier la session Supabase.");
  }
  if (!user) throw new BootstrapAuthenticationRequiredError();

  return { supabase, user };
}

export async function getCurrentUser(): Promise<User> {
  return (await getAuthenticatedBootstrapClient()).user;
}
