import "server-only";

import { cache } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  BootstrapAuthenticationRequiredError,
  BootstrapDataError,
} from "@/server/bootstrap/errors";

export type BootstrapSession = {
  supabase: SupabaseClient;
  user: User;
};

// React scopes this memoization to the current server render.
export const getAuthenticatedBootstrapClient = cache(async (): Promise<BootstrapSession> => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error && !user) throw new BootstrapAuthenticationRequiredError();
  if (error) {
    throw new BootstrapDataError("Impossible de vérifier la session Supabase.", {
      cause: error,
    });
  }
  if (!user) throw new BootstrapAuthenticationRequiredError();

  return { supabase, user };
});

export async function getCurrentUser(): Promise<User> {
  return (await getAuthenticatedBootstrapClient()).user;
}
