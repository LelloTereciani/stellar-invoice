alter table public.invoices add column amount_text text;
update public.invoices set amount_text = amount::text;
alter table public.invoices alter column amount_text set not null;
alter table public.invoices add constraint invoice_amount_text_exact check (amount_text = amount::text);

create or replace function public.sync_invoice_amount_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Preserve the exact seven-decimal database representation across JSON/PostgREST.
  -- Preserva a representação exata de sete decimais do banco através de JSON/PostgREST.
  new.amount_text := new.amount::text;
  return new;
end;
$$;

create trigger sync_invoice_amount_text_before_write
before insert or update of amount on public.invoices
for each row execute function public.sync_invoice_amount_text();

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
  if confirm_invoice.transaction_hash !~ '^[a-fA-F0-9]{64}$' then raise exception 'Invalid transaction hash'; end if;
  if confirm_invoice.confirmed_at < locked_invoice.created_at
    or confirm_invoice.confirmed_at > locked_invoice.due_at
    or confirm_invoice.confirmed_at > now() + interval '5 minutes' then
    if locked_invoice.status = 'pending' and locked_invoice.due_at <= now() then
      update public.invoices set status = 'expired' where id = locked_invoice.id returning * into locked_invoice;
    end if;
    return locked_invoice;
  end if;
  update public.invoices
  set status = 'confirmed', confirmed_transaction_hash = confirm_invoice.transaction_hash, confirmed_at = confirm_invoice.confirmed_at
  where id = locked_invoice.id and status in ('pending', 'expired')
  returning * into locked_invoice;
  return locked_invoice;
end;
$$;

revoke execute on function public.confirm_invoice(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.confirm_invoice(uuid, text, timestamptz) to service_role;
