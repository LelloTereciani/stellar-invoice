create extension if not exists pgcrypto;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  debtor_public_key text not null check (debtor_public_key ~ '^G[A-Z2-7]{55}$'),
  issuer_public_key text not null check (issuer_public_key ~ '^G[A-Z2-7]{55}$'),
  asset_code text not null check (asset_code = 'BRLT'),
  asset_issuer text not null check (asset_issuer = issuer_public_key),
  amount numeric(20, 7) not null check (amount > 0),
  memo text not null unique check (char_length(memo) between 1 and 28),
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired')),
  confirmed_transaction_hash text unique,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'confirmed' and confirmed_transaction_hash is not null and confirmed_at is not null)
    or (status <> 'confirmed' and confirmed_transaction_hash is null and confirmed_at is null)
  )
);

create table public.rejected_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  transaction_hash text not null unique,
  reason text not null check (char_length(reason) between 1 and 500),
  observed_at timestamptz not null default now()
);

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
declare
  confirmed_invoice public.invoices;
begin
  update public.invoices
  set
    status = 'confirmed',
    confirmed_transaction_hash = transaction_hash,
    confirmed_at = confirm_invoice.confirmed_at
  where id = confirm_invoice.invoice_id
    and status = 'pending'
    and due_at > now()
    and transaction_hash ~ '^[a-fA-F0-9]{64}$'
  returning * into confirmed_invoice;

  if confirmed_invoice.id is null then
    raise exception 'Invoice cannot be confirmed';
  end if;

  return confirmed_invoice;
end;
$$;
