-- =====================================================================
-- Quote Comparer — initial schema
--
-- Roles:  owner | contractor | admin
-- Sub-contractors do NOT log in. They act through a bid-invite token,
-- handled server-side with the service-role key.
--
-- PRIVACY RULE (enforced here, not only in the UI):
--   Owners can never read subcontractors, bid_invites, bid_rates, awards
--   or audit_log. They only see owner_quotes once the contractor sends one.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type user_role       as enum ('owner', 'contractor', 'admin');
create type currency_code   as enum ('USD', 'GBP');
create type unit_system     as enum ('imperial', 'metric');
create type job_status      as enum (
  'draft',        -- scope being written
  'bidding',      -- invites out to sub-contractors
  'awarding',     -- contractor comparing / awarding
  'quoted',       -- final quote sent to owner
  'accepted',     -- owner accepted
  'in_progress',
  'completed',
  'cancelled'
);
create type invite_status   as enum ('sent', 'viewed', 'submitted', 'declined', 'expired');
create type award_status    as enum ('offered', 'accepted', 'declined', 'withdrawn');
create type quote_status    as enum ('draft', 'sent', 'accepted', 'changes_requested', 'rejected');

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role not null,
  full_name     text not null default '',
  company_name  text,
  email         text not null,
  phone         text,
  created_at    timestamptz not null default now()
);

-- Create a profile automatically on sign-up.
-- Role comes from sign-up metadata; 'admin' can never be self-assigned.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data->>'role', 'owner');
begin
  insert into profiles (id, role, full_name, company_name, email)
  values (
    new.id,
    case when requested = 'contractor' then 'contractor'::user_role else 'owner'::user_role end,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'company_name', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- Jobs
-- Either party can create. The other party is invited by email and is
-- linked automatically when they sign up / log in (claim_job_invites).
-- ---------------------------------------------------------------------
create table jobs (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  site_address      text,
  currency          currency_code not null default 'USD',
  units             unit_system   not null default 'imperial',
  status            job_status    not null default 'draft',
  created_by        uuid not null references profiles(id),
  owner_id          uuid references profiles(id),
  contractor_id     uuid references profiles(id),
  owner_email       text,   -- pending invite if owner_id is null
  contractor_email  text,   -- pending invite if contractor_id is null
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on jobs (owner_id);
create index on jobs (contractor_id);
create index on jobs (lower(owner_email));
create index on jobs (lower(contractor_email));

-- ---------------------------------------------------------------------
-- Scope items (the work list: stage/trade, description, qty, unit)
-- ---------------------------------------------------------------------
create table scope_items (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references jobs(id) on delete cascade,
  stage        text not null,          -- e.g. Foundation, Framing, Drywall
  trade        text,                   -- e.g. Concrete, Carpentry, Electrical
  description  text not null,
  quantity     numeric(14,2) not null check (quantity >= 0),
  unit         text not null,          -- sq ft, m², linear ft, each, lump sum…
  notes        text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index on scope_items (job_id, sort_order);

-- ---------------------------------------------------------------------
-- Sub-contractors (each main contractor's private address book)
-- ---------------------------------------------------------------------
create table subcontractors (
  id             uuid primary key default gen_random_uuid(),
  contractor_id  uuid not null references profiles(id) on delete cascade,
  name           text not null,
  company_name   text,
  trades         text[] not null default '{}',
  email          text,
  phone          text,
  notes          text,
  created_at     timestamptz not null default now()
);
create index on subcontractors (contractor_id);

-- ---------------------------------------------------------------------
-- Bid invites (one per sub-contractor per job; token = magic link)
-- scope_item_ids null  => sub is asked to price the whole job
-- ---------------------------------------------------------------------
create table bid_invites (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references jobs(id) on delete cascade,
  subcontractor_id  uuid not null references subcontractors(id) on delete cascade,
  token             text not null unique default encode(gen_random_bytes(24), 'hex'),
  scope_item_ids    uuid[],
  status            invite_status not null default 'sent',
  message           text,
  sub_notes         text,
  expires_at        timestamptz not null default now() + interval '14 days',
  submitted_at      timestamptz,
  created_at        timestamptz not null default now(),
  unique (job_id, subcontractor_id)
);
create index on bid_invites (job_id);

-- ---------------------------------------------------------------------
-- Bid rates (one row per sub per scope item)
-- ---------------------------------------------------------------------
create table bid_rates (
  id             uuid primary key default gen_random_uuid(),
  invite_id      uuid not null references bid_invites(id) on delete cascade,
  scope_item_id  uuid not null references scope_items(id) on delete cascade,
  unit_rate      numeric(14,2) not null check (unit_rate >= 0),
  note           text,
  updated_at     timestamptz not null default now(),
  unique (invite_id, scope_item_id)
);
create index on bid_rates (scope_item_id);

-- ---------------------------------------------------------------------
-- Awards
-- scope_item_id null => whole-project award to that invite's sub.
-- ---------------------------------------------------------------------
create table awards (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references jobs(id) on delete cascade,
  scope_item_id  uuid references scope_items(id) on delete cascade,
  invite_id      uuid not null references bid_invites(id) on delete cascade,
  unit_rate      numeric(14,2),        -- snapshot at award time (per-item awards)
  amount         numeric(14,2) not null,
  status         award_status not null default 'offered',
  responded_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index on awards (job_id);
-- Only one live award per item (or per whole job)
create unique index awards_one_live_per_item
  on awards (job_id, coalesce(scope_item_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('offered', 'accepted');

-- ---------------------------------------------------------------------
-- Owner quotes — the ONLY pricing an owner ever sees.
-- Lines carry the contractor's final prices (sub cost + markup),
-- with no reference to sub-contractors.
-- ---------------------------------------------------------------------
create table owner_quotes (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs(id) on delete cascade,
  version         int not null default 1,
  markup_percent  numeric(6,2) not null default 0,
  status          quote_status not null default 'draft',
  message         text,
  owner_response  text,
  sent_at         timestamptz,
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (job_id, version)
);

create table owner_quote_lines (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null references owner_quotes(id) on delete cascade,
  scope_item_id  uuid references scope_items(id) on delete set null,
  stage          text not null,
  description    text not null,
  quantity       numeric(14,2) not null,
  unit           text not null,
  unit_price     numeric(14,2) not null,
  total          numeric(14,2) not null,
  sort_order     int not null default 0
);
create index on owner_quote_lines (quote_id);

-- ---------------------------------------------------------------------
-- Audit log (contractor-side history; owners cannot read it)
-- ---------------------------------------------------------------------
create table audit_log (
  id          bigint generated always as identity primary key,
  job_id      uuid references jobs(id) on delete cascade,
  actor_id    uuid references profiles(id),
  actor_label text,                  -- e.g. sub-contractor name when no login
  action      text not null,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on audit_log (job_id, created_at);

-- ---------------------------------------------------------------------
-- Helper functions (security definer so policies don't recurse)
-- ---------------------------------------------------------------------
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function is_job_contractor(p_job uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from jobs where id = p_job and contractor_id = auth.uid());
$$;

create or replace function is_job_owner(p_job uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from jobs where id = p_job and owner_id = auth.uid());
$$;

create or replace function is_job_party(p_job uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jobs
    where id = p_job
      and (owner_id = auth.uid() or contractor_id = auth.uid() or created_by = auth.uid())
  );
$$;

-- Link pending email invites to the signed-in user. Call after login.
create or replace function claim_job_invites()
returns int language plpgsql security definer set search_path = public as $$
declare
  my_email text;
  my_role  user_role;
  n int := 0;
  m int := 0;
begin
  select lower(email), role into my_email, my_role from profiles where id = auth.uid();
  if my_email is null then return 0; end if;

  if my_role = 'owner' then
    update jobs set owner_id = auth.uid(), owner_email = null, updated_at = now()
     where owner_id is null and lower(owner_email) = my_email;
    get diagnostics n = row_count;
  elsif my_role = 'contractor' then
    update jobs set contractor_id = auth.uid(), contractor_email = null, updated_at = now()
     where contractor_id is null and lower(contractor_email) = my_email;
    get diagnostics m = row_count;
  end if;
  return n + m;
end;
$$;

-- Owner responds to a sent quote (owners have no direct UPDATE rights).
create or replace function respond_to_owner_quote(p_quote uuid, p_status quote_status, p_response text)
returns void language plpgsql security definer set search_path = public as $$
declare
  q owner_quotes;
begin
  if p_status not in ('accepted', 'changes_requested', 'rejected') then
    raise exception 'invalid response status';
  end if;

  select * into q from owner_quotes where id = p_quote;
  if q.id is null or not is_job_owner(q.job_id) then
    raise exception 'not allowed';
  end if;
  if q.status <> 'sent' then
    raise exception 'quote is not awaiting a response';
  end if;

  update owner_quotes
     set status = p_status, owner_response = p_response, responded_at = now()
   where id = p_quote;

  if p_status = 'accepted' then
    perform set_config('app.claiming', 'on', true);   -- system update, bypass owner guard
    update jobs set status = 'accepted', updated_at = now() where id = q.job_id;
    perform set_config('app.claiming', 'off', true);
  end if;

  insert into audit_log (job_id, actor_id, action, details)
  values (q.job_id, auth.uid(), 'owner_quote_' || p_status::text,
          jsonb_build_object('quote_id', p_quote, 'version', q.version));
end;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table profiles          enable row level security;
alter table jobs              enable row level security;
alter table scope_items       enable row level security;
alter table subcontractors    enable row level security;
alter table bid_invites       enable row level security;
alter table bid_rates         enable row level security;
alter table awards            enable row level security;
alter table owner_quotes      enable row level security;
alter table owner_quote_lines enable row level security;
alter table audit_log         enable row level security;

-- profiles: see yourself, and the other party on a shared job
create policy profiles_select on profiles for select using (
  id = auth.uid()
  or is_admin()
  or exists (
    select 1 from jobs j
    where (j.owner_id = auth.uid() and j.contractor_id = profiles.id)
       or (j.contractor_id = auth.uid() and j.owner_id = profiles.id)
  )
);
-- role cannot be changed by the user
create policy profiles_update on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));

-- jobs
create policy jobs_select on jobs for select using (
  owner_id = auth.uid() or contractor_id = auth.uid() or created_by = auth.uid() or is_admin()
);
create policy jobs_insert on jobs for insert with check (
  created_by = auth.uid()
  and (
    (owner_id = auth.uid() and contractor_id is null)
    or (contractor_id = auth.uid() and owner_id is null)
  )
);
create policy jobs_update on jobs for update
  using (owner_id = auth.uid() or contractor_id = auth.uid())
  with check (owner_id = auth.uid() or contractor_id = auth.uid());
create policy jobs_delete on jobs for delete using (created_by = auth.uid() and status = 'draft');

-- scope_items: both parties can read; both can edit while job is a draft,
-- contractor can edit any time before quoting.
create policy scope_select on scope_items for select using (is_job_party(job_id) or is_admin());
create policy scope_write on scope_items for all
  using (
    exists (
      select 1 from jobs j where j.id = job_id and (
        (j.contractor_id = auth.uid() and j.status in ('draft', 'bidding', 'awarding'))
        or ((j.owner_id = auth.uid() or j.created_by = auth.uid()) and j.status = 'draft')
      )
    )
  )
  with check (
    exists (
      select 1 from jobs j where j.id = job_id and (
        (j.contractor_id = auth.uid() and j.status in ('draft', 'bidding', 'awarding'))
        or ((j.owner_id = auth.uid() or j.created_by = auth.uid()) and j.status = 'draft')
      )
    )
  );

-- subcontractors: contractor's private list
create policy subs_all on subcontractors for all
  using (contractor_id = auth.uid())
  with check (contractor_id = auth.uid());

-- bid_invites / bid_rates / awards: job's contractor ONLY (never the owner)
create policy invites_all on bid_invites for all
  using (is_job_contractor(job_id))
  with check (
    is_job_contractor(job_id)
    and exists (select 1 from subcontractors s where s.id = subcontractor_id and s.contractor_id = auth.uid())
  );

create policy rates_select on bid_rates for select using (
  exists (select 1 from bid_invites i where i.id = invite_id and is_job_contractor(i.job_id))
);
-- (sub-contractors write rates via the server using the service-role key)

create policy awards_all on awards for all
  using (is_job_contractor(job_id))
  with check (is_job_contractor(job_id));

-- owner_quotes: contractor full control; owner reads only once sent
create policy oq_contractor on owner_quotes for all
  using (is_job_contractor(job_id))
  with check (is_job_contractor(job_id));
create policy oq_owner_select on owner_quotes for select using (
  is_job_owner(job_id) and status <> 'draft'
);

create policy oql_contractor on owner_quote_lines for all
  using (exists (select 1 from owner_quotes q where q.id = quote_id and is_job_contractor(q.job_id)))
  with check (exists (select 1 from owner_quotes q where q.id = quote_id and is_job_contractor(q.job_id)));
create policy oql_owner_select on owner_quote_lines for select using (
  exists (select 1 from owner_quotes q where q.id = quote_id and is_job_owner(q.job_id) and q.status <> 'draft')
);

-- audit_log: contractor of the job (and admins)
create policy audit_select on audit_log for select using (is_job_contractor(job_id) or is_admin());
create policy audit_insert on audit_log for insert with check (
  actor_id = auth.uid() and is_job_party(job_id)
);

-- keep jobs.updated_at fresh
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger jobs_touch before update on jobs for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------
-- Guard rails on jobs
--  * A user can't be both owner and contractor on one job.
--  * Party columns (owner_id, contractor_id, created_by) can't be changed
--    by normal updates — only claim_job_invites() may fill an empty slot.
--    Without this an owner could set contractor_id = self and read bids.
--  * Owners may only edit descriptive fields, and only while in draft.
--  * Inserted party must match the user's role.
-- ---------------------------------------------------------------------
alter table jobs add constraint jobs_distinct_parties
  check (owner_id is null or contractor_id is null or owner_id <> contractor_id);

create or replace function my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function jobs_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.owner_id is not null and my_role() <> 'owner' then
      raise exception 'only owners can create a job as owner';
    end if;
    if new.contractor_id is not null and my_role() <> 'contractor' then
      raise exception 'only contractors can create a job as contractor';
    end if;
    return new;
  end if;

  -- UPDATE
  if coalesce(current_setting('app.claiming', true), '') = 'on' then
    return new;
  end if;

  if new.created_by is distinct from old.created_by
     or new.owner_id is distinct from old.owner_id
     or new.contractor_id is distinct from old.contractor_id then
    raise exception 'job parties cannot be changed directly';
  end if;

  if auth.uid() = old.owner_id then
    if old.status <> 'draft' then
      raise exception 'owner can only edit a job while it is a draft';
    end if;
    if new.status is distinct from old.status
       or new.owner_email is distinct from old.owner_email then
      raise exception 'owner cannot change these fields';
    end if;
  end if;

  return new;
end;
$$;

create trigger jobs_guard_ins before insert on jobs for each row execute function jobs_guard();
create trigger jobs_guard_upd before update on jobs for each row execute function jobs_guard();

-- re-define claim function to pass the guard
create or replace function claim_job_invites()
returns int language plpgsql security definer set search_path = public as $$
declare
  my_email text;
  r user_role;
  n int := 0;
begin
  select lower(email), role into my_email, r from profiles where id = auth.uid();
  if my_email is null then return 0; end if;

  perform set_config('app.claiming', 'on', true);

  if r = 'owner' then
    update jobs set owner_id = auth.uid(), owner_email = null
     where owner_id is null and lower(owner_email) = my_email
       and contractor_id is distinct from auth.uid();
    get diagnostics n = row_count;
  elsif r = 'contractor' then
    update jobs set contractor_id = auth.uid(), contractor_email = null
     where contractor_id is null and lower(contractor_email) = my_email
       and owner_id is distinct from auth.uid();
    get diagnostics n = row_count;
  end if;

  perform set_config('app.claiming', 'off', true);
  return n;
end;
$$;
