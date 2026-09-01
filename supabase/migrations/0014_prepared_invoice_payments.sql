alter table public.invoices add column prepared_payment_xdr text;
alter table public.invoices add column prepared_payment_hash text unique;
alter table public.invoices add column prepared_payment_expires_at timestamptz;
alter table public.invoices add constraint prepared_payment_consistency check (
  (prepared_payment_xdr is null and prepared_payment_hash is null and prepared_payment_expires_at is null)
  or (prepared_payment_xdr is not null and prepared_payment_hash is not null and prepared_payment_expires_at is not null)
);

create or replace function public.prepare_invoice_payment(
  invoice_id uuid,
  debtor_public_key text,
  payment_xdr text,
  payment_hash text,
  payment_expires_at timestamptz,
  requested_at timestamptz
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare locked_invoice public.invoices;
begin
  select * into locked_invoice from public.invoices where id = prepare_invoice_payment.invoice_id for update;
  if locked_invoice.id is null or locked_invoice.debtor_public_key <> prepare_invoice_payment.debtor_public_key then
    raise exception 'Invoice was not found';
  end if;
  if locked_invoice.status <> 'pending' or locked_invoice.due_at <= prepare_invoice_payment.requested_at then
    raise exception 'Invoice is not payable';
  end if;
  if locked_invoice.prepared_payment_expires_at > prepare_invoice_payment.requested_at then return locked_invoice; end if;
  if char_length(prepare_invoice_payment.payment_xdr) not between 100 and 10000
    or prepare_invoice_payment.payment_xdr !~ '^[A-Za-z0-9+/=]+$'
    or prepare_invoice_payment.payment_hash !~ '^[a-f0-9]{64}$'
    or prepare_invoice_payment.payment_expires_at <= prepare_invoice_payment.requested_at
    or prepare_invoice_payment.payment_expires_at > prepare_invoice_payment.requested_at + interval '5 minutes' then
    raise exception 'Invalid prepared invoice payment';
  end if;
  update public.invoices set
    prepared_payment_xdr = prepare_invoice_payment.payment_xdr,
    prepared_payment_hash = prepare_invoice_payment.payment_hash,
    prepared_payment_expires_at = prepare_invoice_payment.payment_expires_at
  where id = locked_invoice.id returning * into locked_invoice;
  return locked_invoice;
end;
$$;

revoke execute on function public.prepare_invoice_payment(uuid, text, text, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.prepare_invoice_payment(uuid, text, text, text, timestamptz, timestamptz) to service_role;
