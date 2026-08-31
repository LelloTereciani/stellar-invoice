create table public.wallet_challenges (
  id uuid primary key,
  wallet_public_key text not null check (wallet_public_key ~ '^G[A-Z2-7]{55}$'),
  message_hash text not null unique check (message_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

alter table public.wallet_challenges enable row level security;
revoke all on public.wallet_challenges from public, anon, authenticated;
grant select, update, delete on public.wallet_challenges to service_role;

create or replace function public.create_wallet_challenge(
  challenge_id uuid,
  challenge_wallet_public_key text,
  challenge_hash text,
  challenge_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('stellar-invoice:wallet-challenges'));
  delete from public.wallet_challenges where expires_at <= now() or consumed_at is not null;

  if (select count(*) from public.wallet_challenges where created_at > now() - interval '1 minute') >= 100 then
    raise exception 'Global wallet challenge rate limit exceeded';
  end if;
  if (select count(*) from public.wallet_challenges where wallet_public_key = challenge_wallet_public_key and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'Wallet challenge rate limit exceeded';
  end if;
  if challenge_expires_at <= now() or challenge_expires_at > now() + interval '6 minutes' then
    raise exception 'Invalid wallet challenge expiry';
  end if;
  if challenge_wallet_public_key !~ '^G[A-Z2-7]{55}$' or challenge_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid wallet challenge';
  end if;

  insert into public.wallet_challenges(id, wallet_public_key, message_hash, expires_at)
  values (challenge_id, challenge_wallet_public_key, challenge_hash, challenge_expires_at);
end;
$$;

revoke execute on function public.create_wallet_challenge(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_wallet_challenge(uuid, text, text, timestamptz) to service_role;
