-- "Something changed" counter for live screens when the app runs on several servers (Vercel).
create table app_revision (
  id   int primary key default 1 check (id = 1),
  rev  bigint not null default 1
);
insert into app_revision (id, rev) values (1, 1);
alter table app_revision enable row level security;
create policy revision_select on app_revision for select using (true);
create policy revision_update on app_revision for update using (true) with check (true);
