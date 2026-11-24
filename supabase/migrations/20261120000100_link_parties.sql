-- Link an invited owner/contractor immediately if they already have an account
-- (claim_job_invites only runs when the invited person logs in).
create or replace function link_job_parties(p_job uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_job_party(p_job) then
    raise exception 'not allowed';
  end if;

  perform set_config('app.claiming', 'on', true);

  update jobs j
     set contractor_id = p.id, contractor_email = null
    from profiles p
   where j.id = p_job
     and j.contractor_id is null
     and lower(j.contractor_email) = lower(p.email)
     and p.role = 'contractor'
     and p.id is distinct from j.owner_id;

  update jobs j
     set owner_id = p.id, owner_email = null
    from profiles p
   where j.id = p_job
     and j.owner_id is null
     and lower(j.owner_email) = lower(p.email)
     and p.role = 'owner'
     and p.id is distinct from j.contractor_id;

  perform set_config('app.claiming', 'off', true);
end;
$$;

grant execute on function link_job_parties(uuid) to authenticated;
