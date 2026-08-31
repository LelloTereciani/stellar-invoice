\set ON_ERROR_STOP on

begin;

create function public.test_assert(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if condition is not true then raise exception 'DATABASE TEST FAILED: %', message; end if;
end;
$$;
grant execute on function public.test_assert(boolean, text) to authenticated, service_role;

select public.test_assert(not has_table_privilege('anon', 'public.invoices', 'SELECT'), 'anon cannot read invoices');
select public.test_assert(has_table_privilege('authenticated', 'public.invoices', 'SELECT'), 'authenticated can reach invoice RLS');
select public.test_assert(not has_table_privilege('authenticated', 'public.invoices', 'INSERT'), 'authenticated cannot insert invoices');
select public.test_assert(has_table_privilege('service_role', 'public.invoices', 'INSERT,SELECT,UPDATE,DELETE'), 'service role has explicit invoice privileges');
select public.test_assert(not has_function_privilege('anon', 'public.confirm_invoice(uuid,text,timestamptz)', 'EXECUTE'), 'anon cannot confirm invoices');
select public.test_assert(not has_function_privilege('authenticated', 'public.confirm_invoice(uuid,text,timestamptz)', 'EXECUTE'), 'authenticated cannot confirm invoices');
select public.test_assert(has_function_privilege('service_role', 'public.confirm_invoice(uuid,text,timestamptz)', 'EXECUTE'), 'service role can confirm invoices');
select public.test_assert(not has_function_privilege('authenticated', 'public.create_wallet_challenge(uuid,text,text,timestamptz)', 'EXECUTE'), 'authenticated cannot mint wallet challenges');
select public.test_assert((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.invoices'::regclass,
  'public.rejected_payment_attempts'::regclass,
  'public.demo_sessions'::regclass,
  'public.demo_distributions'::regclass,
  'public.issuer_challenges'::regclass,
  'public.wallet_challenges'::regclass
)), 'RLS is enabled on all application tables');

insert into public.invoices (
  id, debtor_public_key, issuer_public_key, asset_code, asset_issuer, amount, memo, due_at
) values
  ('00000000-0000-4000-8000-000000000001', 'GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 'BRLT', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 10.0000000, 'invoice-one', now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000002', 'GDDMM4RDODH6BW3AD6RSPMKHWRYQRXEFRPEOJIV7WZ6I2RXXCDUUVRKM', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 'BRLT', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 20.0000000, 'invoice-two', now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000003', 'GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 'BRLT', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 30.0000000, 'invoice-expired', now() - interval '1 day');

insert into public.rejected_payment_attempts(invoice_id, transaction_hash, reason) values
  ('00000000-0000-4000-8000-000000000001', repeat('d', 64), 'wrong amount'),
  ('00000000-0000-4000-8000-000000000002', repeat('e', 64), 'wrong memo');

do $$
declare uniqueness_enforced boolean := false;
begin
  begin
    insert into public.invoices (debtor_public_key, issuer_public_key, asset_code, asset_issuer, amount, memo, due_at)
    values ('GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 'BRLT', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 1, 'invoice-one', now() + interval '1 day');
  exception when unique_violation then uniqueness_enforced := true;
  end;
  perform public.test_assert(uniqueness_enforced, 'memo uniqueness is enforced');
end;
$$;

set local role authenticated;
set local request.jwt.claims = '{"stellar_public_key":"GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY"}';
select public.test_assert((select count(*) from public.invoices) = 2, 'debtor sees only its two invoices');
select public.test_assert((select count(*) from public.rejected_payment_attempts) = 1, 'debtor sees only its rejected attempt');
set local request.jwt.claims = '{}';
select public.test_assert((select count(*) from public.invoices) = 0, 'missing wallet claim sees no invoices');
reset role;

set local role service_role;
select public.test_assert(
  (public.confirm_invoice('00000000-0000-4000-8000-000000000001', repeat('a', 64), now())).status = 'confirmed',
  'pending invoice confirms'
);
select public.test_assert(
  (public.confirm_invoice('00000000-0000-4000-8000-000000000001', repeat('a', 64), now())).confirmed_transaction_hash = repeat('a', 64),
  'same transaction is idempotent'
);
select public.test_assert(
  (public.confirm_invoice('00000000-0000-4000-8000-000000000003', repeat('c', 64), now())).status = 'expired',
  'past-due invoice expires instead of confirming'
);
select public.test_assert(
  (select confirmed_transaction_hash is null from public.invoices where id = '00000000-0000-4000-8000-000000000003'),
  'expired invoice has no confirmation hash'
);
reset role;

select public.test_assert((select count(*) from public.invoices where confirmed_transaction_hash = repeat('a', 64)) = 1, 'a hash confirms one invoice');

rollback;
