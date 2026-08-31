create or replace function public.confirm_invoice(
  invoice_id uuid,
  transaction_hash text,
  confirmed_at timestamptz
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare locked_invoice public.invoices;
begin
  select * into locked_invoice from public.invoices where id = confirm_invoice.invoice_id for update;
  if locked_invoice.id is null then raise exception 'Invoice was not found'; end if;
  if locked_invoice.status = 'confirmed' then
    if locked_invoice.confirmed_transaction_hash = confirm_invoice.transaction_hash then return locked_invoice; end if;
    raise exception 'Invoice is already confirmed by another transaction';
  end if;
  if locked_invoice.status = 'expired' or locked_invoice.due_at <= now() then
    if locked_invoice.status = 'pending' then
      update public.invoices set status = 'expired' where id = locked_invoice.id returning * into locked_invoice;
    end if;
    return locked_invoice;
  end if;
  if confirm_invoice.transaction_hash !~ '^[a-fA-F0-9]{64}$' then raise exception 'Invalid transaction hash'; end if;
  update public.invoices
  set status = 'confirmed', confirmed_transaction_hash = confirm_invoice.transaction_hash, confirmed_at = confirm_invoice.confirmed_at
  where id = locked_invoice.id and status = 'pending'
  returning * into locked_invoice;
  return locked_invoice;
end;
$$;

create or replace function public.expire_invoice(invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare locked_invoice public.invoices;
begin
  select * into locked_invoice from public.invoices where id = expire_invoice.invoice_id for update;
  if locked_invoice.id is null then raise exception 'Invoice was not found'; end if;
  if locked_invoice.status = 'pending' and locked_invoice.due_at <= now() then
    update public.invoices set status = 'expired' where id = locked_invoice.id returning * into locked_invoice;
  end if;
  return locked_invoice;
end;
$$;

create or replace function public.record_rejected_payment_attempt(
  invoice_id uuid,
  transaction_hash text,
  rejection_reason text
)
returns public.rejected_payment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare recorded_attempt public.rejected_payment_attempts;
begin
  if record_rejected_payment_attempt.transaction_hash !~ '^[a-fA-F0-9]{64}$' then raise exception 'Invalid transaction hash'; end if;
  if char_length(record_rejected_payment_attempt.rejection_reason) not between 1 and 500 then raise exception 'Invalid rejection reason'; end if;
  insert into public.rejected_payment_attempts(invoice_id, transaction_hash, reason)
  values (record_rejected_payment_attempt.invoice_id, record_rejected_payment_attempt.transaction_hash, record_rejected_payment_attempt.rejection_reason)
  on conflict (transaction_hash) do nothing;
  select * into recorded_attempt from public.rejected_payment_attempts
  where rejected_payment_attempts.transaction_hash = record_rejected_payment_attempt.transaction_hash
    and rejected_payment_attempts.invoice_id = record_rejected_payment_attempt.invoice_id;
  if recorded_attempt.id is null then raise exception 'Transaction hash belongs to another invoice'; end if;
  return recorded_attempt;
end;
$$;

revoke execute on function public.confirm_invoice(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.expire_invoice(uuid) from public, anon, authenticated;
revoke execute on function public.record_rejected_payment_attempt(uuid, text, text) from public, anon, authenticated;
grant execute on function public.confirm_invoice(uuid, text, timestamptz) to service_role;
grant execute on function public.expire_invoice(uuid) to service_role;
grant execute on function public.record_rejected_payment_attempt(uuid, text, text) to service_role;
