import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Q } from "./index";
import { seedDemo, seedDemoFeedback } from "./seed";

/**
 * Database setup shared by both drivers (local PGlite and hosted Postgres such as Neon):
 * the Supabase-like auth stub, the schema migrations, and the demo data.
 * Safe to run on every start: each step checks what is already there.
 */

export const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

// Mimics the parts of Supabase the schema relies on: auth.users, auth.uid(), the authenticated role.
export const AUTH_STUB = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
  end $$;
  -- the app's own database user must be allowed to switch to it (SET ROLE authenticated)
  do $$ begin
    execute format('grant authenticated to %I', current_user);
  exception when others then null;
  end $$;
  create extension if not exists pgcrypto;
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

export const GRANTS = `
  grant usage on schema public to authenticated;
  grant all on all tables in schema public to authenticated;
  grant all on all sequences in schema public to authenticated;
  grant execute on all functions in schema public to authenticated;
`;

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(MIGRATIONS_DIR, name), "utf8") }));
}

/**
 * Runs the whole setup through `tx`, which must run `fn` inside ONE transaction.
 * A transaction-level advisory lock makes concurrent server starts (e.g. several
 * Vercel functions waking up together) wait for each other instead of clashing.
 */
export async function setupDatabase(tx: <T>(fn: (q: Q) => Promise<T>) => Promise<T>, exec: (q: Q, sql: string) => Promise<void>) {
  const LOCK = `select pg_advisory_xact_lock(4207311)`;

  await tx(async (q) => {
    await q(LOCK);
    await q(`create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())`);
    const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from public._migrations`);
    if (n === 0) await exec(q, AUTH_STUB);
  });

  for (const file of migrationFiles()) {
    await tx(async (q) => {
      await q(LOCK);
      const done = await q(`select 1 from public._migrations where name = $1`, [file.name]);
      if (done.length) return;
      await exec(q, file.sql);
      await exec(q, GRANTS);
      await q(`insert into public._migrations (name) values ($1)`, [file.name]);
    });
  }

  // demo data whenever the database has no users yet (also if an earlier attempt was interrupted)
  await tx(async (q) => {
    await q(LOCK);
    const [{ n }] = await q<{ n: number }>(`select count(*)::int as n from profiles`);
    if (n === 0) await seedDemo(q);
  });
  // demo feedback (also added to older demo databases, once)
  await tx(async (q) => {
    await q(LOCK);
    await seedDemoFeedback(q);
  }).catch((e) => console.error("[demo] feedback seed failed:", e));
}
