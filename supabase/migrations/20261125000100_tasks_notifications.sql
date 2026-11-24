-- =====================================================================
-- Flow v2:
--   contractor's assignment = 'planned' awards (invisible to subs)
--   owner accepts quote  -> planned awards become 'accepted',
--                           work_tasks are created, subs are notified
--   subs update task progress (not_started -> in_progress -> done)
-- Plus an in-app notifications table (also used as the simulated email inbox).
-- =====================================================================

-- One live award per item now includes planned ones
drop index if exists awards_one_live_per_item;
create unique index awards_one_live_per_item
  on awards (job_id, coalesce(scope_item_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('planned', 'offered', 'accepted');

-- ---------------------------------------------------------------- tasks
create type task_status as enum ('not_started', 'in_progress', 'done');

create table work_tasks (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references jobs(id) on delete cascade,
  award_id       uuid not null references awards(id) on delete cascade,
  invite_id      uuid not null references bid_invites(id) on delete cascade,
  scope_item_id  uuid references scope_items(id) on delete set null,
  stage          text not null,
  description    text not null,
  quantity       numeric(14,2) not null default 1,
  unit           text not null default 'each',
  status         task_status not null default 'not_started',
  started_at     timestamptz,
  done_at        timestamptz,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);
create index on work_tasks (job_id, sort_order);
create index on work_tasks (invite_id);

alter table work_tasks enable row level security;
-- contractor sees everything; the owner sees progress (no sub-contractor names are stored here)
create policy tasks_select on work_tasks for select using (is_job_contractor(job_id) or is_job_owner(job_id));
create policy tasks_contractor_write on work_tasks for update
  using (is_job_contractor(job_id)) with check (is_job_contractor(job_id));

-- ---------------------------------------------------------------- notifications
create table notifications (
  id                bigint generated always as identity primary key,
  job_id            uuid references jobs(id) on delete cascade,
  profile_id        uuid references profiles(id) on delete cascade,        -- app users
  subcontractor_id  uuid references subcontractors(id) on delete cascade,  -- simulated email inbox
  kind              text not null,
  title             text not null,
  body              text,
  link              text,
  created_at        timestamptz not null default now(),
  read_at           timestamptz,
  check (profile_id is not null or subcontractor_id is not null)
);
create index on notifications (profile_id, created_at desc);
create index on notifications (subcontractor_id, created_at desc);

alter table notifications enable row level security;
create policy notif_select on notifications for select using (profile_id = auth.uid());
create policy notif_update on notifications for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy notif_insert on notifications for insert with check (
  -- app users may notify the other party of a shared job, or their own sub-contractors
  (job_id is null or is_job_party(job_id))
  and (subcontractor_id is null or exists (select 1 from subcontractors s where s.id = subcontractor_id and s.contractor_id = auth.uid()))
);

-- ---------------------------------------------------------------- owner accepts -> hand out the work
create or replace function respond_to_owner_quote(p_quote uuid, p_status quote_status, p_response text)
returns void language plpgsql security definer set search_path = public as $$
declare
  q owner_quotes;
  j jobs;
  a record;
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
  select * into j from jobs where id = q.job_id;

  update owner_quotes
     set status = p_status, owner_response = p_response, responded_at = now()
   where id = p_quote;

  insert into audit_log (job_id, actor_id, action, details)
  values (q.job_id, auth.uid(), 'owner_quote_' || p_status::text,
          jsonb_build_object('quote_id', p_quote, 'version', q.version));

  -- tell the contractor
  insert into notifications (job_id, profile_id, kind, title, body, link)
  values (q.job_id, j.contractor_id, 'quote_' || p_status::text,
          case p_status when 'accepted' then 'Client accepted the quote'
                        when 'changes_requested' then 'Client asked for changes'
                        else 'Client rejected the quote' end,
          j.title || coalesce(': ' || p_response, ''),
          '/jobs/' || q.job_id || '/quote');

  if p_status = 'accepted' then
    perform set_config('app.claiming', 'on', true);   -- system update, bypass owner guard
    update jobs set status = 'accepted', updated_at = now() where id = q.job_id;
    perform set_config('app.claiming', 'off', true);

    -- the planned assignment becomes real work
    update awards set status = 'accepted', responded_at = now()
     where job_id = q.job_id and status in ('planned', 'offered');

    for a in
      select aw.id as award_id, aw.invite_id, aw.scope_item_id, i.subcontractor_id, i.token
        from awards aw join bid_invites i on i.id = aw.invite_id
       where aw.job_id = q.job_id and aw.status = 'accepted'
    loop
      insert into work_tasks (job_id, award_id, invite_id, scope_item_id, stage, description, quantity, unit, sort_order)
      select q.job_id, a.award_id, a.invite_id, si.id, si.stage, si.description, si.quantity, si.unit, si.sort_order
        from scope_items si
       where si.job_id = q.job_id
         and (a.scope_item_id is null or si.id = a.scope_item_id)
         and not exists (select 1 from work_tasks t where t.award_id = a.award_id and t.scope_item_id = si.id);

      -- simulated email to the sub-contractor
      insert into notifications (job_id, subcontractor_id, kind, title, body, link)
      select q.job_id, a.subcontractor_id, 'job_awarded',
             'You got the job: ' || j.title,
             'Northline Builders has confirmed your work. Open your task list and start when you''re ready.',
             '/bid/' || a.token
       where not exists (select 1 from notifications x
                          where x.job_id = q.job_id and x.subcontractor_id = a.subcontractor_id and x.kind = 'job_awarded');
    end loop;
  end if;
end;
$$;
