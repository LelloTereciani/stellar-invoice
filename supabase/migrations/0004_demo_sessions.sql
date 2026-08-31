create table public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_public_key text not null unique check (customer_public_key ~ '^G[A-Z2-7]{55}$'),
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

revoke all on public.demo_sessions from anon, authenticated;
