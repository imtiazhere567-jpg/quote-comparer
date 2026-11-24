import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, isDemoMode, supabaseKey, supabaseUrl } from "@/lib/supabase/env";
import { GATE_COOKIE, gateToken } from "@/lib/site-gate";

const PROTECTED = ["/dashboard", "/jobs", "/subcontractors", "/invoices", "/revenue", "/service-areas", "/settings"];
const AUTH_PAGES = ["/login", "/signup"];

/** Refreshes the Supabase session cookie and guards signed-in areas. */
export async function proxy(request: NextRequest) {
  // Optional shared password in front of the whole site (SITE_PASSWORD on Vercel).
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword && !request.nextUrl.pathname.startsWith("/gate")) {
    if (request.cookies.get(GATE_COOKIE)?.value !== (await gateToken(sitePassword))) {
      const url = request.nextUrl.clone();
      url.pathname = "/gate";
      url.search = "";
      url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }

  if (isDemoMode) {
    // Demo users can always reach /login to switch user (also avoids loops on a stale cookie).
    return guard(request, request.cookies.has(DEMO_COOKIE), NextResponse.next(), false);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // Must run before anything else so a refreshed token is written to the response.
  const { data } = await supabase.auth.getClaims();
  return guard(request, Boolean(data?.claims), response);
}

function guard(request: NextRequest, signedIn: boolean, response: NextResponse, bounceAuthPages = true) {
  const path = request.nextUrl.pathname;

  if (!signedIn && PROTECTED.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (bounceAuthPages && signedIn && AUTH_PAGES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static files, images and the sub-contractor bid links (/bid/*), which use tokens, not sessions.
    "/((?!_next/static|_next/image|favicon.ico|bid/|api/rev|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
