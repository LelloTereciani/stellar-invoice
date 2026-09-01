\set ON_ERROR_STOP on

do $$
declare
  rls_ok boolean;
begin
  if to_regclass('public.invoices') is null
    or to_regclass('public.demo_distributions') is null
    or to_regclass('public.demo_distribution_mutex') is null then
    raise exception 'Required restored tables are missing';
  end if;

  select bool_and(relrowsecurity) into rls_ok from pg_class where oid in (
    'public.invoices'::regclass,
    'public.rejected_payment_attempts'::regclass,
    'public.demo_sessions'::regclass,
    'public.demo_distributions'::regclass,
    'public.issuer_challenges'::regclass,
    'public.wallet_challenges'::regclass,
    'public.demo_distribution_mutex'::regclass
  );
  if rls_ok is not true then raise exception 'RLS was not preserved for every application table'; end if;

  if has_table_privilege('anon', 'public.invoices', 'SELECT')
    or has_table_privilege('authenticated', 'public.invoices', 'INSERT')
    or not has_table_privilege('authenticated', 'public.invoices', 'SELECT')
    or not has_table_privilege('service_role', 'public.invoices', 'INSERT,SELECT,UPDATE,DELETE') then
    raise exception 'Restored invoice table privileges are unsafe';
  end if;

  if has_function_privilege('anon', 'public.confirm_invoice(uuid,text,timestamptz)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.confirm_invoice(uuid,text,timestamptz)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.confirm_invoice(uuid,text,timestamptz)', 'EXECUTE')
    or has_function_privilege('anon', 'public.create_demo_session(uuid,text,text,text,timestamptz)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.prepare_invoice_payment(uuid,text,text,text,timestamptz,timestamptz)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.acquire_demo_distribution_lock(uuid,timestamptz)', 'EXECUTE') then
    raise exception 'Restored SECURITY DEFINER privileges are unsafe';
  end if;
end;
$$;
