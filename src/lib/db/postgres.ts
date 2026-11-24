import "server-only";
import postgres from "postgres";
import type { Driver, Q } from "./index";
import { setupDatabase } from "./setup";

/**
 * Hosted Postgres (e.g. Neon on Vercel). Use the POOLED connection string as DATABASE_URL.
 * The schema and demo data are created automatically on first use.
 */
const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres>; __pgReady?: Promise<void> };

function client() {
  // prepare:false keeps it compatible with connection poolers (Neon / Supabase).
  g.__pg ??= postgres(process.env.DATABASE_URL!, { prepare: false, max: Number(process.env.PG_POOL_MAX ?? 5), idle_timeout: 20, connect_timeout: 15 });
  return g.__pg;
}

async function run<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  return (await client().begin(async (tx) => {
    const q: Q = async (text, params = []) =>
      // no parameters: simple protocol, which also allows several statements (migrations)
      (params.length ? await tx.unsafe(text, params as never[]) : await tx.unsafe(text)) as never;
    return fn(q);
  })) as never;
}

export function postgresDriver(): Driver {
  g.__pgReady ??= setupDatabase(run, (q, sql) => q(sql).then(() => undefined)).catch((e) => {
    g.__pgReady = undefined; // try again on the next request
    throw e;
  });
  return {
    async transaction(fn) {
      await g.__pgReady;
      return run(fn);
    },
  };
}
