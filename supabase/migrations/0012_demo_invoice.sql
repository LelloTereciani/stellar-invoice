alter table public.demo_distributions
add column invoice_id uuid unique references public.invoices(id);

create or replace function public.ensure_demo_invoice(
  demo_customer_public_key text,
  demo_issuer_public_key text,
  demo_amount numeric,
  demo_memo text,
  demo_due_at timestamptz
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
-- The row lock makes retries return one invoice instead of creating duplicates.
-- O bloqueio da linha faz as tentativas retornarem uma fatura em vez de criar duplicatas.
declare distribution_record public.demo_distributions;
declare invoice_record public.invoices;
begin
  select * into distribution_record from public.demo_distributions
  where customer_public_key = demo_customer_public_key for update;
  if distribution_record.id is null or distribution_record.status <> 'confirmed' then
    raise exception 'Demo distribution is not confirmed';
  end if;
  if distribution_record.invoice_id is not null then
    select * into invoice_record from public.invoices where id = distribution_record.invoice_id;
    return invoice_record;
  end if;
  if demo_amount <= 0 or demo_amount > 25 or demo_due_at <= now()
    or demo_customer_public_key !~ '^G[A-Z2-7]{55}$'
    or demo_issuer_public_key !~ '^G[A-Z2-7]{55}$'
    or char_length(demo_memo) not between 1 and 28 then
    raise exception 'Invalid demo invoice';
  end if;
  insert into public.invoices(debtor_public_key, issuer_public_key, asset_code, asset_issuer, amount, memo, due_at)
  values (demo_customer_public_key, demo_issuer_public_key, 'BRLT', demo_issuer_public_key, demo_amount, demo_memo, demo_due_at)
  returning * into invoice_record;
  update public.demo_distributions set invoice_id = invoice_record.id, updated_at = now()
  where id = distribution_record.id;
  return invoice_record;
end;
$$;

revoke execute on function public.ensure_demo_invoice(text, text, numeric, text, timestamptz) from public, anon, authenticated;
grant execute on function public.ensure_demo_invoice(text, text, numeric, text, timestamptz) to service_role;
