-- This system has ONE contractor (Northline Builders).
-- New sign-ups are always homeowners. A contractor account can only be
-- created while none exists yet (first-time setup); after that, any
-- request for role 'contractor' at sign-up becomes 'owner'.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data->>'role', 'owner');
  has_contractor boolean := exists (select 1 from profiles where role = 'contractor');
begin
  insert into profiles (id, role, full_name, company_name, email)
  values (
    new.id,
    case when requested = 'contractor' and not has_contractor then 'contractor'::user_role else 'owner'::user_role end,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'company_name', ''),
    new.email
  );
  return new;
end;
$$;
