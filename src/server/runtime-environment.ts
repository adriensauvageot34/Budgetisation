import "server-only";

export type SafeRuntimeEnvironment = {
  readonly publicSupabaseProjectRef: string | null;
  readonly serverSupabaseProjectRef: string | null;
  readonly sameSupabaseProject: boolean;
  readonly environment: string | null;
  readonly commitSha: string | null;
};

export function supabaseProjectRef(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const match = /^([a-z0-9-]+)\.supabase\.co$/.exec(hostname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function safeRuntimeEnvironment(): SafeRuntimeEnvironment {
  const publicSupabaseProjectRef = supabaseProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serverSupabaseProjectRef = supabaseProjectRef(process.env.SUPABASE_URL);
  return {
    publicSupabaseProjectRef,
    serverSupabaseProjectRef,
    sameSupabaseProject:
      publicSupabaseProjectRef !== null &&
      serverSupabaseProjectRef !== null &&
      publicSupabaseProjectRef === serverSupabaseProjectRef,
    environment: process.env.VERCEL_ENV ?? null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  };
}

export function assertSameSupabaseProject(): SafeRuntimeEnvironment {
  const environment = safeRuntimeEnvironment();
  if (!environment.sameSupabaseProject) {
    throw new Error("SUPABASE_ENVIRONMENT_MISMATCH");
  }
  return environment;
}
