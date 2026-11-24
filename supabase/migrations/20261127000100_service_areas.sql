-- Where Northline Builders works. Homeowners can only create projects inside an active area.
-- The admin adds, pauses or removes areas as the company grows. US and UK only.

create table service_areas (
  id            uuid primary key default gen_random_uuid(),
  country       text not null check (country in ('US', 'UK')),
  city          text not null,
  region        text,                         -- state (US) or county (UK)
  zip_prefixes  text[] not null default '{}', -- e.g. {787} or {LS1,LS2}; empty = any ZIP/postcode in that city
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create unique index service_areas_city on service_areas (country, lower(city));

alter table service_areas enable row level security;
create policy areas_select on service_areas for select using (true);
create policy areas_write on service_areas for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('contractor', 'admin')))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('contractor', 'admin')));

insert into service_areas (country, city, region, zip_prefixes) values
  ('US', 'Austin',      'TX', '{787}'),
  ('US', 'Round Rock',  'TX', '{786}'),
  ('US', 'Georgetown',  'TX', '{786}'),
  ('US', 'Cedar Park',  'TX', '{786}'),
  ('US', 'Pflugerville','TX', '{786}'),
  ('UK', 'Leeds',       'West Yorkshire', '{LS}'),
  ('UK', 'Manchester',  'Greater Manchester', '{M}');
