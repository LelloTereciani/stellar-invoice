create or replace function public.confirm_invoice(
  invoice_id uuid,
  transaction_hash text,
  confirmed_at timestamptz
)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare confirmed_invoice public.invoices;
begin
  update public.invoices
  set status = 'confirmed', confirmed_transaction_hash = transaction_hash, confirmed_at = confirm_invoice.confirmed_at
  where id = confirm_invoice.invoice_id
    and status = 'pending'
    and due_at > now()
    and transaction_hash ~ '^[a-fA-F0-9]{64}$'
  returning * into confirmed_invoice;
  if confirmed_invoice.id is null then raise exception 'Invoice cannot be confirmed'; end if;
  return confirmed_invoice;
end;
$$;

revoke execute on function public.confirm_invoice(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.confirm_invoice(uuid, text, timestamptz) to service_role;
