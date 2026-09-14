alter table public.invoices add column receiver_public_key text;
update public.invoices set receiver_public_key = issuer_public_key where receiver_public_key is null;
alter table public.invoices alter column receiver_public_key set not null;
alter table public.invoices add constraint invoices_receiver_public_key_format
  check (receiver_public_key ~ '^G[A-Z2-7]{55}$');
