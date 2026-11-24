import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Driver, Q } from "./index";
import { seedDemo, seedDemoFeedback } from "./seed";

// Kept OUTSIDE the project folder: the dev server watches the project, and database
// writes inside it would trigger endless reloads.
const DATA_DIR = process.env.DEMO_DB_DIR ?? path.join(os.homedir(), ".bidlevel-demo", "pglite");
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

// Mimics the parts of Supabase the schema relies on: auth.users, auth.uid(), the authenticated role.
const AUTH_STUB = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
  end $$;
  create schema if not exists auth;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    raw_user_meta_data jsonb not null default '{}',
    created_at timestamptz not null default now()
  );
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(coalesce(
      current_setting('request.jwt.claim.sub', true),
      current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
    ), '')::uuid
  $$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
`;

const GRANTS = `
  grant usage on schema public to authenticated;
  grant all on all tables in schema public to authenticated;
  grant all on all sequences in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
`;

const g = globalThis as unknown as { __pglite?: Promise<PGlite>; __pgliteLock?: Promise<unknown> };

async function open(): Promise<PGlite> {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new PGlite(DATA_DIR, { extensions: { pgcrypto } });
  await db.waitReady;

  await db.exec(`create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())`);
  const applied = new Set(
    (await db.query<{ name: string }>(`select name from public._migrations`)).rows.map((r) => r.name),
  );
  const isFresh = applied.size === 0;

  if (isFresh) await db.exec(AUTH_STUB);

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      await tx.exec(GRANTS);
      await tx.query(`insert into public._migrations (name) values ($1)`, [file]);
    });
  }

  if (isFresh) {
    await db.transaction(async (tx) => {
      const q: Q = async (text, params = []) => (await tx.query(text, params)).rows as never;
      await seedDemo(q);
    });
  }
  // demo feedback (also added to older demo databases, once)
  await db
    .transaction(async (tx) => {
      const q: Q = async (text, params = []) => (await tx.query(text, params)).rows as never;
      await seedDemoFeedback(q);
    })
    .catch((e) => console.error("[demo] feedback seed failed:", e));
  return db;
}

export function pgliteDriver(): Driver {
  g.__pglite ??= open();
  return {
    async transaction(fn) {
      const db = await g.__pglite!;
      // PGlite is a single connection: run transactions one at a time.
      const run = async () =>
        db.transaction(async (tx) => {
          const q: Q = async (text, params = []) => (await tx.query(text, params)).rows as never;
          return fn(q);
        });
      const prev = g.__pgliteLock ?? Promise.resolve();
      const next = prev.then(run, run);
      g.__pgliteLock = next.catch(() => undefined);
      return next;
    },
  };
}
