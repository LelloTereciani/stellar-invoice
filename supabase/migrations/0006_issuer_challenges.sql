create table public.issuer_challenges (
  id uuid primary key,
  nonce_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

revoke all on public.issuer_challenges from anon, authenticated;
