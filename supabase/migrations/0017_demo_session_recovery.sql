-- Allow the same browser wallet to resume an interrupted allowance without creating another one.
-- Permite que a mesma carteira do navegador retome uma remessa interrompida sem criar outra.
create or replace function public.create_demo_session(session_id uuid, session_customer_public_key text, session_token_hash text, session_request_fingerprint text, session_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare existing_session public.demo_sessions;
declare distribution_status text;
begin
  perform pg_advisory_xact_lock(hashtext('stellar-invoice:demo-sessions'));
  delete from public.demo_sessions where created_at < now() - interval '30 days' and not exists (
    select 1 from public.demo_distributions where demo_distributions.customer_public_key = demo_sessions.customer_public_key
  );
  if session_expires_at <= now() or session_expires_at > now() + interval '11 minutes'
    or session_customer_public_key !~ '^G[A-Z2-7]{55}$' or session_token_hash !~ '^[a-f0-9]{64}$'
    or session_request_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid demo session'; end if;
  select * into existing_session from public.demo_sessions where customer_public_key = session_customer_public_key for update;
  if existing_session.id is not null then
    select status into distribution_status from public.demo_distributions
    where customer_public_key = session_customer_public_key for update;
    if distribution_status = 'confirmed' then
      raise exception 'Demo wallet has already received its BRLT allowance';
    end if;
    update public.demo_sessions set token_hash = session_token_hash, request_fingerprint = session_request_fingerprint,
      expires_at = session_expires_at, consumed_at = null where id = existing_session.id;
    return;
  end if;
  if (select count(*) from public.demo_sessions where created_at >= date_trunc('day', now())) >= 200 then raise exception 'Daily demo session limit exceeded'; end if;
  if (select count(*) from public.demo_sessions where request_fingerprint = session_request_fingerprint and created_at >= date_trunc('day', now())) >= 10 then raise exception 'Demo request limit exceeded'; end if;
  insert into public.demo_sessions(id, customer_public_key, token_hash, request_fingerprint, expires_at)
  values (session_id, session_customer_public_key, session_token_hash, session_request_fingerprint, session_expires_at);
end; $$;

revoke execute on function public.create_demo_session(uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_demo_session(uuid, text, text, text, timestamptz) to service_role;
