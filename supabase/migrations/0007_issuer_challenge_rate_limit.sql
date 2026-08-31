create or replace function public.create_issuer_challenge(
  challenge_id uuid,
  challenge_hash text,
  challenge_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('stellar-invoice:issuer-challenges'));
  delete from public.issuer_challenges where expires_at <= now() or consumed_at is not null;
  if (select count(*) from public.issuer_challenges where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Issuer challenge rate limit exceeded';
  end if;
  if challenge_expires_at <= now() or challenge_expires_at > now() + interval '6 minutes' then
    raise exception 'Invalid issuer challenge expiry';
  end if;
  if challenge_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid issuer challenge hash';
  end if;
  insert into public.issuer_challenges(id, nonce_hash, expires_at)
  values (challenge_id, challenge_hash, challenge_expires_at);
end;
$$;

revoke execute on function public.create_issuer_challenge(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_issuer_challenge(uuid, text, timestamptz) to service_role;
