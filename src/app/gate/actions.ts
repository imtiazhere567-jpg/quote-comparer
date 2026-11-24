"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, gateToken } from "@/lib/site-gate";

export type GateState = { error?: string } | undefined;

export async function enterSite(_prev: GateState, fd: FormData): Promise<GateState> {
  const expected = process.env.SITE_PASSWORD;
  const next = String(fd.get("next") ?? "/");
  if (!expected) redirect("/");
  if (String(fd.get("password") ?? "") !== expected) return { error: "That password isn't right." };
  (await cookies()).set(GATE_COOKIE, await gateToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
