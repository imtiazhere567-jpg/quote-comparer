-- Invoices & payments
--   sub invoice    : created automatically when a sub-contractor finishes all their tasks (sub -> Northline)
--   client invoice : Northline sends it to the homeowner when the work is done (Northline -> homeowner)
--   When the homeowner pays, Northline keeps its margin and every sub invoice of that project is paid out.

create type invoice_kind as enum ('sub', 'client');
create type invoice_status as enum ('sent', 'paid');
create sequence invoice_no start 1001;

create table invoices (
  id          uuid primary key default gen_random_uuid(),
  number      text not null unique,
  job_id      uuid not null references jobs(id) on delete cascade,
  kind        invoice_kind not null,
  invite_id   uuid references bid_invites(id) on delete cascade,   -- sub invoices only
  amount      numeric(14,2) not null,
  status      invoice_status not null default 'sent',
  note        text,
  issued_at   timestamptz not null default now(),
  paid_at     timestamptz,
  check ((kind = 'sub') = (invite_id is not null))
);
create unique index invoices_one_client on invoices (job_id) where kind = 'client';
create unique index invoices_one_sub on invoices (invite_id) where kind = 'sub';
create index on invoices (job_id);

create table invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity    numeric(14,2) not null,
  unit        text not null,
  unit_price  numeric(14,2) not null,
  total       numeric(14,2) not null,
  sort_order  int not null default 0
);
create index on invoice_lines (invoice_id);

create table payments (
  id          bigint generated always as identity primary key,
  job_id      uuid not null references jobs(id) on delete cascade,
  invoice_id  uuid not null references invoices(id) on delete cascade,
  direction   text not null check (direction in ('in', 'out')),   -- in: from the homeowner, out: to a sub-contractor
  amount      numeric(14,2) not null,
  created_at  timestamptz not null default now()
);
create index on payments (job_id);

alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table payments enable row level security;

-- the contractor sees all; the homeowner only sees the client invoice (never sub-contractor costs)
create policy invoices_select on invoices for select
  using (is_job_contractor(job_id) or (kind = 'client' and is_job_owner(job_id)));
create policy invoices_insert on invoices for insert
  with check (kind = 'client' and is_job_contractor(job_id));
create policy invoice_lines_select on invoice_lines for select
  using (exists (select 1 from invoices i where i.id = invoice_id
                  and (is_job_contractor(i.job_id) or (i.kind = 'client' and is_job_owner(i.job_id)))));
create policy invoice_lines_insert on invoice_lines for insert
  with check (exists (select 1 from invoices i where i.id = invoice_id and i.kind = 'client' and is_job_contractor(i.job_id)));
create policy payments_select on payments for select using (is_job_contractor(job_id));

create or replace function next_invoice_number(p_kind invoice_kind)
returns text language sql as $$
  select case p_kind when 'sub' then 'SUB-' else 'INV-' end || nextval('invoice_no')::text
$$;

-- ---------------------------------------------------------------- homeowner pays (simulated card payment)
create or replace function pay_client_invoice(p_invoice uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  inv invoices;
  j jobs;
  s record;
  paid_out numeric := 0;
begin
  select * into inv from invoices where id = p_invoice;
  if inv.id is null or inv.kind <> 'client' or not is_job_owner(inv.job_id) then
    raise exception 'not allowed';
  end if;
  if inv.status = 'paid' then
    return;
  end if;
  select * into j from jobs where id = inv.job_id;

  update invoices set status = 'paid', paid_at = now() where id = inv.id;
  insert into payments (job_id, invoice_id, direction, amount) values (inv.job_id, inv.id, 'in', inv.amount);

  -- pay every sub-contractor invoice of this project
  for s in
    select si.id, si.amount, si.number, i.subcontractor_id
      from invoices si join bid_invites i on i.id = si.invite_id
     where si.job_id = inv.job_id and si.kind = 'sub' and si.status = 'sent'
  loop
    update invoices set status = 'paid', paid_at = now() where id = s.id;
    insert into payments (job_id, invoice_id, direction, amount) values (inv.job_id, s.id, 'out', s.amount);
    paid_out := paid_out + s.amount;
    insert into notifications (job_id, subcontractor_id, kind, title, body, link)
    values (inv.job_id, s.subcontractor_id, 'payment_sent',
            'Payment sent: ' || to_char(s.amount, 'FM999,999,990.00') || ' for ' || j.title,
            'Northline Builders has paid your invoice ' || s.number || '. Thank you for your work.',
            null);
  end loop;

  insert into notifications (job_id, profile_id, kind, title, body, link)
  values (inv.job_id, j.contractor_id, 'invoice_paid',
          'Client paid ' || inv.number || ': ' || j.title,
          'Received ' || to_char(inv.amount, 'FM999,999,990.00') || '. Paid out ' || to_char(paid_out, 'FM999,999,990.00') ||
          ' to sub-contractors. You kept ' || to_char(inv.amount - paid_out, 'FM999,999,990.00') || '.',
          '/revenue');

  insert into audit_log (job_id, actor_id, action, details)
  values (inv.job_id, auth.uid(), 'invoice_paid', jsonb_build_object('invoice', inv.number, 'amount', inv.amount, 'paid_out', paid_out));
end;
$$;

-- ---------------------------------------------------------------- owner responds to the quote
-- (same as before, plus: sub-contractors who did not get any work are told why)
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
          jsonb_build_object('quote_id', p_quote, 'version', q.version, 'response', p_response));

  insert into notifications (job_id, profile_id, kind, title, body, link)
  values (q.job_id, j.contractor_id, 'quote_' || p_status::text,
          case p_status when 'accepted' then 'Client accepted the quote: ' || j.title
                        when 'changes_requested' then 'Client asked for changes: ' || j.title
                        else 'Client rejected the quote: ' || j.title end,
          coalesce('“' || p_response || '”', j.title),
          '/jobs/' || q.job_id || '/quote');

  if p_status = 'accepted' then
    perform set_config('app.claiming', 'on', true);
    update jobs set status = 'accepted', updated_at = now() where id = q.job_id;
    perform set_config('app.claiming', 'off', true);

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

      insert into notifications (job_id, subcontractor_id, kind, title, body, link)
      select q.job_id, a.subcontractor_id, 'job_awarded',
             'You got the job: ' || j.title,
             'Northline Builders has confirmed your work. Open your task list and start when you''re ready.',
             '/bid/' || a.token
       where not exists (select 1 from notifications x
                          where x.job_id = q.job_id and x.subcontractor_id = a.subcontractor_id and x.kind = 'job_awarded');
    end loop;

    -- sub-contractors who priced the work but got nothing: tell them, kindly, and by how much they were higher
    insert into notifications (job_id, subcontractor_id, kind, title, body, link)
    select q.job_id, i.subcontractor_id, 'job_lost',
           'Not this time: ' || j.title,
           'Thank you for pricing ' || j.title || '. This time the work went to another sub-contractor with a lower price' ||
           case when c.mine > c.chosen and c.chosen > 0
                then ': your price was about ' || round((c.mine / c.chosen - 1) * 100)::text || '% higher than the price we chose'
                else '' end ||
           '. Sharper rates will give you a better chance next time. We''ll keep sending you new projects.',
           null
      from bid_invites i
      cross join lateral (
        select coalesce(sum(mr.unit_rate * si.quantity), 0) as mine,
               coalesce(sum(wr.unit_rate * si.quantity), 0) as chosen
          from bid_rates mr
          join scope_items si on si.id = mr.scope_item_id
          join work_tasks t on t.job_id = q.job_id and t.scope_item_id = si.id
          join bid_rates wr on wr.invite_id = t.invite_id and wr.scope_item_id = si.id
         where mr.invite_id = i.id
      ) c
     where i.job_id = q.job_id and i.status = 'submitted'
       and not exists (select 1 from awards aw where aw.invite_id = i.id and aw.status = 'accepted')
       and not exists (select 1 from notifications x
                        where x.job_id = q.job_id and x.subcontractor_id = i.subcontractor_id and x.kind = 'job_lost');
  end if;
end;
$$;
