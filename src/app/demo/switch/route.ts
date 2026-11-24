import { NextResponse, type NextRequest } from "next/server";
import { asSystem, asUser } from "@/lib/db";
import { getHouseContractor } from "@/lib/house-contractor";
import { DEMO_COOKIE, OWNER_COOKIE, isDemoMode } from "@/lib/supabase/env";

const TABS = new Set(["", "/bids", "/compare", "/quote", "/progress"]);

/**
 * Demo only: switch the logged-in user to the other side of a project
 * (Northline Builders on the web, or the project's homeowner in the phone app) and open it.
 * GET /demo/switch?as=contractor|owner&job=<id>&tab=/bids
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  if (!isDemoMode) return NextResponse.redirect(new URL("/login", url));

  const as = url.searchParams.get("as");
  const job = url.searchParams.get("job") ?? "";
  const tab = url.searchParams.get("tab") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(job) || !TABS.has(tab)) return NextResponse.redirect(new URL("/login", url));

  let userId: string | null = null;
  if (as === "contractor") userId = (await getHouseContractor())?.id ?? null;
  else if (as === "owner") {
    const rows = await asSystem((q) => q<{ owner_id: string | null }>(`select owner_id from jobs where id = $1`, [job]));
    userId = rows[0]?.owner_id ?? null;
  }
  if (!userId) return NextResponse.redirect(new URL("/login", url));

  await asUser(userId, (q) => q(`select claim_job_invites()`));
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 };
  // the homeowner lives in the phone app; Northline in the web dashboard
  const res = NextResponse.redirect(
    new URL(as === "owner" ? `/simulator?open=${encodeURIComponent(`/m/projects/${job}`)}` : `/jobs/${job}${tab}`, url),
  );
  res.cookies.set(as === "owner" ? OWNER_COOKIE : DEMO_COOKIE, userId, opts);
  return res;
}
