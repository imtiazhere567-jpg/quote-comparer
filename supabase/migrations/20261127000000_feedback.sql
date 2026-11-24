-- Homeowner feedback after paying the final invoice.
-- (the approval threshold comes from app settings; 4 until settings exist)
create or replace function rating_threshold() returns int language sql stable as $$ select 4 $$;
-- The homeowner rates each part of the work (grouped by the sub-contractor who did it,
-- but shown only by trade, never by name). The rating is recorded against that sub-contractor.
--   4–5 stars  -> approved automatically
--   1–3 stars  -> the homeowner must say why; Northline is alerted

create table work_ratings (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references jobs(id) on delete cascade,
  invite_id         uuid not null references bid_invites(id) on delete cascade,
  subcontractor_id  uuid not null references subcontractors(id) on delete cascade,
  work_label        text not null,                      -- what the homeowner saw, e.g. "Foundation, Roofing"
  stars             int not null check (stars between 1 and 5),
  reason            text,
  approved          boolean not null,                   -- stars >= the approval threshold in settings (default 4)
  created_at        timestamptz not null default now(),
  unique (job_id, invite_id),
  check (approved or coalesce(length(trim(reason)), 0) > 0)
);
create index on work_ratings (subcontractor_id);

create table project_feedback (
  job_id      uuid primary key references jobs(id) on delete cascade,
  comment     text,
  created_at  timestamptz not null default now()
);

alter table work_ratings enable row level security;
alter table project_feedback enable row level security;
-- Northline sees everything; the homeowner sees their own ratings (without sub-contractor names: those live in another table)
create policy ratings_select on work_ratings for select using (is_job_contractor(job_id) or is_job_owner(job_id));
create policy feedback_select on project_feedback for select using (is_job_contractor(job_id) or is_job_owner(job_id));

-- p_ratings: [{ "invite_id": "...", "stars": 1-5, "reason": "..." }, ...]
create or replace function submit_project_feedback(p_job uuid, p_ratings jsonb, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare
  j jobs;
  r jsonb;
  inv record;
  label text;
  n_low int := 0;
begin
  if not is_job_owner(p_job) then
    raise exception 'not allowed';
  end if;
  select * into j from jobs where id = p_job;
  if not exists (select 1 from invoices where job_id = p_job and kind = 'client' and status = 'paid') then
    raise exception 'Feedback opens once the invoice is paid.';
  end if;
  if exists (select 1 from project_feedback where job_id = p_job) then
    raise exception 'You already sent feedback for this project.';
  end if;

  for r in select * from jsonb_array_elements(p_ratings) loop
    select i.id, i.subcontractor_id, s.name into inv
      from bid_invites i join subcontractors s on s.id = i.subcontractor_id
     where i.id = (r ->> 'invite_id')::uuid and i.job_id = p_job
       and exists (select 1 from work_tasks t where t.invite_id = i.id);
    if inv.id is null then
      raise exception 'unknown part of the work';
    end if;
    select string_agg(distinct t.stage, ', ') into label from work_tasks t where t.invite_id = inv.id;

    insert into work_ratings (job_id, invite_id, subcontractor_id, work_label, stars, reason, approved)
    values (p_job, inv.id, inv.subcontractor_id, label, (r ->> 'stars')::int, nullif(trim(r ->> 'reason'), ''),
            (r ->> 'stars')::int >= rating_threshold());

    if (r ->> 'stars')::int < rating_threshold() then
      n_low := n_low + 1;
      insert into notifications (job_id, profile_id, kind, title, body, link)
      values (p_job, j.contractor_id, 'low_rating',
              inv.name || ' got ' || (r ->> 'stars') || '★ on ' || j.title,
              label || ': “' || trim(r ->> 'reason') || '”',
              '/subcontractors');
    end if;
  end loop;

  if not exists (select 1 from work_ratings where job_id = p_job) then
    raise exception 'Rate at least one part of the work.';
  end if;
  insert into project_feedback (job_id, comment) values (p_job, nullif(trim(p_comment), ''));

  insert into notifications (job_id, profile_id, kind, title, body, link)
  values (p_job, j.contractor_id, 'feedback',
          'Client feedback: ' || j.title,
          case when n_low = 0 then 'All parts rated ' || rating_threshold() || '★ or more. Approved.'
               else n_low || ' part(s) rated below ' || rating_threshold() || '★. See the reasons.' end ||
          coalesce(' “' || nullif(trim(p_comment), '') || '”', ''),
          '/subcontractors');

  insert into audit_log (job_id, actor_id, action, details)
  values (p_job, auth.uid(), 'feedback_sent', jsonb_build_object('ratings', p_ratings, 'comment', p_comment));
end;
$$;
