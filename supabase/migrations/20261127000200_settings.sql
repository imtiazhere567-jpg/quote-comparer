-- App settings (one row), edited by Northline on the Settings page.

create table app_settings (
  id                 int primary key default 1 check (id = 1),
  app_name           text not null default 'BidLevel',
  company_name       text not null default 'Northline Builders',
  contact_email      text,
  contact_phone      text,
  default_markup     numeric(6,2) not null default 15 check (default_markup >= 0 and default_markup <= 200),
  default_currency   currency_code not null default 'USD',
  default_units      unit_system not null default 'imperial',
  bid_days           int not null default 14 check (bid_days between 1 and 90),
  invoice_due_days   int not null default 14 check (invoice_due_days between 0 and 120),
  invoice_note       text,
  quote_message      text,
  rating_threshold   int not null default 4 check (rating_threshold between 2 and 5),
  updated_at         timestamptz not null default now()
);
insert into app_settings (id, contact_email, contact_phone, invoice_note, quote_message)
values (1, 'hello@northline.example', '(512) 555-0142',
        'Thank you for choosing us. Payment is due within 14 days.',
        'Thanks for the chance to price your project. This quote includes all labour and materials listed.');

alter table app_settings enable row level security;
create policy settings_select on app_settings for select using (true);
create policy settings_update on app_settings for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('contractor', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('contractor', 'admin')));

create or replace function company() returns text language sql stable security definer set search_path = public as $$
  select coalesce((select company_name from app_settings where id = 1), 'Northline Builders')
$$;

create or replace function rating_threshold() returns int language sql stable security definer set search_path = public as $$
  select coalesce((select rating_threshold from app_settings where id = 1), 4)
$$;

-- bid links expire after the configured number of days
create or replace function bid_deadline() returns timestamptz language sql stable security definer set search_path = public as $$
  select now() + make_interval(days => coalesce((select bid_days from app_settings where id = 1), 14))
$$;
alter table bid_invites alter column expires_at set default bid_deadline();

-- messages written by the database use the company name from settings
do $$
declare
  f text;
  def text;
begin
  foreach f in array array['respond_to_owner_quote(uuid,quote_status,text)', 'pay_client_invoice(uuid)'] loop
    def := pg_get_functiondef(f::regprocedure);
    def := replace(def, '''Northline Builders', 'company() || ''');
    execute def;
  end loop;
end $$;
