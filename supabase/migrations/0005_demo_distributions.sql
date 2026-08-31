create table public.demo_distributions (
  id uuid primary key default gen_random_uuid(),
  customer_public_key text not null unique references public.demo_sessions(customer_public_key),
  transaction_hash text unique,
  created_at timestamptz not null default now()
);

revoke all on public.demo_distributions from anon, authenticated;
