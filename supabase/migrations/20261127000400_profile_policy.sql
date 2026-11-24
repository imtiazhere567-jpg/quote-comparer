-- Fix: the profiles update rule looked up profiles inside its own check ("infinite recursion").
-- Read the caller's role through a security-definer function instead.
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = my_role());
