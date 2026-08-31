alter table public.invoices enable row level security;
alter table public.rejected_payment_attempts enable row level security;

create policy "debtors read their invoices"
on public.invoices for select to authenticated
using (debtor_public_key = coalesce(auth.jwt() ->> 'stellar_public_key', ''));

create policy "debtors read rejected attempts for their invoices"
on public.rejected_payment_attempts for select to authenticated
using (
  exists (
    select 1 from public.invoices
    where invoices.id = rejected_payment_attempts.invoice_id
      and invoices.debtor_public_key = coalesce(auth.jwt() ->> 'stellar_public_key', '')
  )
);

revoke all on public.invoices, public.rejected_payment_attempts from anon;
grant select on public.invoices, public.rejected_payment_attempts to authenticated;
grant execute on function public.confirm_invoice(uuid, text, timestamptz) to service_role;
