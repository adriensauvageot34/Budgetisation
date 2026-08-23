import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();

  const supabase = createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const authenticated = Boolean(data?.claims);
  const isLogin = request.nextUrl.pathname === "/connexion";

  if (!authenticated && !isLogin) {
    const url = request.nextUrl.clone();
    const returnDestination = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.pathname = "/connexion";
    url.search = "";
    url.searchParams.set("retour", returnDestination);
    return NextResponse.redirect(url, { headers: response.headers });
  }

  if (authenticated && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url, { headers: response.headers });
  }

  return response;
}
