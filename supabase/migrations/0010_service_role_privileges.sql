-- The application uses a private server-side Supabase client; browser roles never receive write access.
-- A aplicação usa um cliente Supabase privado no servidor; papéis do navegador nunca recebem escrita.
alter table public.demo_sessions enable row level security;
alter table public.demo_distributions enable row level security;
alter table public.issuer_challenges enable row level security;

revoke all on public.invoices,
  public.rejected_payment_attempts,
  public.demo_sessions,
  public.demo_distributions,
  public.issuer_challenges,
  public.wallet_challenges
from public, anon;

revoke insert, update, delete on public.invoices, public.rejected_payment_attempts from authenticated;
revoke all on public.demo_sessions, public.demo_distributions, public.issuer_challenges, public.wallet_challenges from authenticated;

grant select, insert, update, delete on public.invoices,
  public.rejected_payment_attempts,
  public.demo_sessions,
  public.demo_distributions,
  public.issuer_challenges,
  public.wallet_challenges
to service_role;
