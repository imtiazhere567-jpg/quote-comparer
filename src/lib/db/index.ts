import "server-only";
import { connection } from "next/server";
import { bumpRevision, isWrite } from "./revision";

/**
 * One SQL data layer, two drivers:
 *  - DATABASE_URL set  → real Postgres (Supabase) via postgres.js
 *  - not set           → local demo database (PGlite, stored in ~/.bidlevel-demo)
 *
 * All app queries run through `asUser`, which switches to the `authenticated`
 * role and sets the JWT subject, so Row Level Security applies exactly as it
 * would through Supabase's API. `asSystem` bypasses RLS and is only used after
 * verifying a sub-contractor's invite token, or for demo sign-up.
 */

export type Q = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

export type Driver = {
  transaction<T>(fn: (q: Q) => Promise<T>): Promise<T>;
};

export const isDemoDb = !process.env.DATABASE_URL;

async function getDriver(): Promise<Driver> {
  let d: Driver;
  if (isDemoDb) {
    const { pgliteDriver } = await import("./pglite");
    d = pgliteDriver();
  } else {
    const { postgresDriver } = await import("./postgres");
    d = postgresDriver();
  }
  return {
    // note any write, so open screens know to refresh once it's committed
    async transaction(fn) {
      let wrote = false;
      const out = await d.transaction(async (q) => {
        const res = await fn((text, params) => {
          if (!wrote && isWrite(text)) wrote = true;
          return q(text, params);
        });
        // hosted database: several servers, so the "something changed" counter lives in the database
        if (wrote && !isDemoDb) await q(`update app_revision set rev = rev + 1 where id = 1`);
        return res;
      });
      if (wrote) bumpRevision();
      return out;
    },
  };
}

/** Database reads are always per-request: never let Next.js try to prerender them. */
async function dynamic() {
  // Don't catch: during prerendering Next.js signals "postpone" through this call.
  await connection();
}

export async function asUser<T>(userId: string, fn: (q: Q) => Promise<T>): Promise<T> {
  await dynamic();
  const driver = await getDriver();
  return driver.transaction(async (q) => {
    await q(`set local role authenticated`);
    await q(
      `select set_config('request.jwt.claim.sub', $1, true),
              set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)`,
      [userId],
    );
    return fn(q);
  });
}

export async function asSystem<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  await dynamic();
  const driver = await getDriver();
  return driver.transaction(fn);
}

/** Postgres numeric comes back as a string from some drivers. */
export const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
