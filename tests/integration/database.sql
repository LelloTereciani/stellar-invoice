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
select public.test_assert(not has_function_privilege('authenticated', 'public.reserve_demo_distribution(text,uuid,timestamptz)', 'EXECUTE'), 'authenticated cannot reserve demo distributions');
select public.test_assert(not has_function_privilege('authenticated', 'public.ensure_demo_invoice(text,text,numeric,text,timestamptz)', 'EXECUTE'), 'authenticated cannot create demo invoices');
select public.test_assert(not has_function_privilege('authenticated', 'public.prepare_invoice_payment(uuid,text,text,text,timestamptz,timestamptz)', 'EXECUTE'), 'authenticated cannot prepare invoice payments');
select public.test_assert(not has_function_privilege('authenticated', 'public.acquire_demo_distribution_lock(uuid,timestamptz)', 'EXECUTE'), 'authenticated cannot acquire the distributor lock');
select public.test_assert((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.invoices'::regclass,
  'public.rejected_payment_attempts'::regclass,
  'public.demo_sessions'::regclass,
  'public.demo_distributions'::regclass,
  'public.issuer_challenges'::regclass,
  'public.wallet_challenges'::regclass
  ,'public.demo_distribution_mutex'::regclass
)), 'RLS is enabled on all application tables');

insert into public.invoices (
  id, debtor_public_key, issuer_public_key, asset_code, asset_issuer, amount, memo, due_at
) values
  ('00000000-0000-4000-8000-000000000001', 'GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 'BRLT', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 10.0000000, 'invoice-one', now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000002', 'GDDMM4RDODH6BW3AD6RSPMKHWRYQRXEFRPEOJIV7WZ6I2RXXCDUUVRKM', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 'BRLT', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 20.0000000, 'invoice-two', now() + interval '1 day'),
  ('00000000-0000-4000-8000-000000000003', 'GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 'BRLT', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 30.0000000, 'invoice-expired', now() - interval '1 day');

update public.invoices set created_at = now() - interval '2 days' where id = '00000000-0000-4000-8000-000000000003';
insert into public.invoices (
  id, debtor_public_key, issuer_public_key, asset_code, asset_issuer, amount, memo, created_at, due_at
) values (
  '00000000-0000-4000-8000-000000000004', 'GBKMZ2CK7QANNLRLAX7BI32X7MTI7W542OLPNCZF46G2SEPWCDTEM2Q7',
  'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 'BRLT',
  'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 40.0000000,
  'invoice-paid-late', now() - interval '2 days', now() - interval '1 day'
);
select public.test_assert((select amount_text from public.invoices where id = '00000000-0000-4000-8000-000000000001') = '10.0000000', 'numeric amount has an exact PostgREST text projection');

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
  (public.prepare_invoice_payment(
    '00000000-0000-4000-8000-000000000001',
    'GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY',
    repeat('C', 120), repeat('7', 64), now() + interval '3 minutes', now()
  )).prepared_payment_hash = repeat('7', 64),
  'first payment preparation stores its exact transaction hash'
);
select public.test_assert(
  (public.prepare_invoice_payment(
    '00000000-0000-4000-8000-000000000001',
    'GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY',
    repeat('D', 120), repeat('8', 64), now() + interval '4 minutes', now()
  )).prepared_payment_hash = repeat('7', 64),
  'retry reuses an unexpired prepared payment instead of allocating a second sequence'
);
select public.test_assert(
  (public.confirm_invoice('00000000-0000-4000-8000-000000000001', repeat('a', 64), now())).status = 'confirmed',
  'pending invoice confirms'
);
select public.test_assert(
  (public.confirm_invoice('00000000-0000-4000-8000-000000000001', repeat('a', 64), now())).confirmed_transaction_hash = repeat('a', 64),
  'same transaction is idempotent'
);
select public.test_assert(
  (public.confirm_invoice('00000000-0000-4000-8000-000000000003', repeat('c', 64), now() - interval '36 hours')).status = 'confirmed',
  'payment observed before the due date confirms even when verified later'
);
select public.test_assert(
  (select confirmed_at < due_at from public.invoices where id = '00000000-0000-4000-8000-000000000003'),
  'ledger observation time is retained as confirmation time'
);
select public.test_assert(
  (public.confirm_invoice('00000000-0000-4000-8000-000000000004', repeat('b', 64), now())).status = 'expired',
  'payment observed after the due date does not confirm'
);
reset role;

select public.test_assert((select count(*) from public.invoices where confirmed_transaction_hash = repeat('a', 64)) = 1, 'a hash confirms one invoice');

set local role service_role;
select public.acquire_demo_distribution_lock('90000000-0000-4000-8000-000000000001', now());
do $$
declare concurrent_lock_rejected boolean := false;
begin
  begin
    perform public.acquire_demo_distribution_lock('90000000-0000-4000-8000-000000000002', now());
  exception when raise_exception then concurrent_lock_rejected := true;
  end;
  perform public.test_assert(concurrent_lock_rejected, 'concurrent distributor sequence allocation is rejected');
end;
$$;
select public.release_demo_distribution_lock('90000000-0000-4000-8000-000000000001');
select public.acquire_demo_distribution_lock('90000000-0000-4000-8000-000000000002', now());
select public.release_demo_distribution_lock('90000000-0000-4000-8000-000000000002');
select public.create_demo_session(
  '10000000-0000-4000-8000-000000000001',
  'GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA',
  repeat('1', 64), repeat('9', 64), now() + interval '10 minutes'
);
select public.test_assert(
  (public.reserve_demo_distribution(repeat('1', 64), '20000000-0000-4000-8000-000000000001', now())).status = 'preparing',
  'first demo request owns the preparation reservation'
);
select public.create_demo_session(
  '10000000-0000-4000-8000-000000000002',
  'GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA',
  repeat('e', 64), repeat('7', 64), now() + interval '10 minutes'
);
select public.test_assert(
  (public.reserve_demo_distribution(repeat('e', 64), '20000000-0000-4000-8000-000000000004', now())).status = 'preparing',
  'a refreshed session recovers a preparing distribution'
);
select public.test_assert(
  (public.store_demo_distribution_xdr('GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA', '20000000-0000-4000-8000-000000000001', repeat('A', 120), repeat('f', 64))).status = 'prepared',
  'signed XDR and hash are persisted before broadcast'
);
select public.test_assert(
  (public.reserve_demo_distribution(repeat('e', 64), '20000000-0000-4000-8000-000000000002', now())).transaction_hash = repeat('f', 64),
  'retry recovers the same prepared transaction'
);
select public.create_demo_session(
  '10000000-0000-4000-8000-000000000003',
  'GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA',
  repeat('a', 64), repeat('7', 64), now() + interval '10 minutes'
);
select public.test_assert(
  (public.reserve_demo_distribution(repeat('a', 64), '20000000-0000-4000-8000-000000000003', now())).transaction_hash = repeat('f', 64),
  'a refreshed session recovers the same unconfirmed distribution'
);
select public.test_assert((select count(*) from public.demo_distributions) = 1, 'retry does not create a second allowance');
select public.test_assert(
  (public.reset_expired_demo_distribution('GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA', repeat('f', 64), '20000000-0000-4000-8000-000000000002')).status = 'preparing',
  'expired prepared distribution returns to the recoverable state'
);
select public.test_assert(
  (public.store_demo_distribution_xdr('GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA', '20000000-0000-4000-8000-000000000002', repeat('B', 120), repeat('6', 64))).status = 'prepared',
  'replacement distribution stores one new sequence-bound transaction'
);
select public.test_assert(
  (public.complete_demo_distribution('GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA', repeat('6', 64))).status = 'confirmed',
  'prepared distribution completes'
);
select public.test_assert(
  (public.complete_demo_distribution('GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA', repeat('6', 64))).status = 'confirmed',
  'distribution completion is idempotent'
);
do $$
declare confirmed_session_rejected boolean := false;
begin
  begin
    perform public.create_demo_session(gen_random_uuid(), 'GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA', repeat('b', 64), repeat('7', 64), now() + interval '10 minutes');
  exception when raise_exception then confirmed_session_rejected := true;
  end;
  perform public.test_assert(confirmed_session_rejected, 'a confirmed allowance cannot receive a refreshed session');
end;
$$;
select public.test_assert(
  (public.ensure_demo_invoice('GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 5.0000000, 'demo-invoice-one', now() + interval '1 day')).id =
  (public.ensure_demo_invoice('GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA', 'GDTTX5V34X5BFL74VTHDU2W2555DYASROG2O23DNP3SKF3EUCK6FAHBH', 5.0000000, 'ignored-retry-memo', now() + interval '1 day')).id,
  'demo invoice creation is idempotent'
);
select public.test_assert((select count(*) from public.invoices where debtor_public_key = 'GDBZKLVO3AS7EMDDAF7TP5QLW7BPUTQXN7ECWGUYXY7HEZ7NKCB4M3GA') = 1, 'demo wallet receives one invoice');
reset role;

do $$
declare rate_limit_enforced boolean := false;
declare session_number integer;
begin
  for session_number in 1..10 loop
    perform public.create_demo_session(
      gen_random_uuid(),
      'G' || repeat('A', 54) || chr(64 + session_number),
      md5('rate-token-' || session_number) || md5('rate-token-tail-' || session_number),
      repeat('8', 64),
      now() + interval '10 minutes'
    );
  end loop;
  begin
    perform public.create_demo_session(gen_random_uuid(), 'G' || repeat('A', 54) || 'K', repeat('c', 64), repeat('8', 64), now() + interval '10 minutes');
  exception when raise_exception then rate_limit_enforced := true;
  end;
  perform public.test_assert(rate_limit_enforced, 'eleventh daily session from one origin is rejected');
end;
$$;

do $$
declare current_count integer;
declare global_limit_enforced boolean := false;
declare session_number integer;
begin
  select count(*) into current_count from public.demo_sessions where created_at >= date_trunc('day', now());
  for session_number in (current_count + 1)..200 loop
    perform public.create_demo_session(
      gen_random_uuid(),
      'G' || upper(translate(lpad(to_hex(1000 + session_number), 55, 'a'), '0189', 'GHIJ')),
      md5('global-token-' || session_number) || md5('global-token-tail-' || session_number),
      md5('global-origin-' || session_number) || md5('global-origin-tail-' || session_number),
      now() + interval '10 minutes'
    );
  end loop;
  begin
    perform public.create_demo_session(gen_random_uuid(), 'G' || repeat('Z', 55), repeat('d', 64), repeat('e', 64), now() + interval '10 minutes');
  exception when raise_exception then global_limit_enforced := true;
  end;
  perform public.test_assert(global_limit_enforced, '201st daily demo session is rejected globally');
end;
$$;

rollback;
