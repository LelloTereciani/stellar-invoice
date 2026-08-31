alter table public.demo_sessions add column request_fingerprint text;
alter table public.demo_sessions add constraint demo_sessions_token_hash_format check (token_hash ~ '^[a-f0-9]{64}$');
alter table public.demo_sessions add constraint demo_sessions_request_fingerprint_format check (request_fingerprint is null or request_fingerprint ~ '^[a-f0-9]{64}$');

alter table public.demo_distributions add column status text not null default 'preparing';
alter table public.demo_distributions add column signed_xdr text;
alter table public.demo_distributions add column attempt_key uuid;
alter table public.demo_distributions add column updated_at timestamptz not null default now();
update public.demo_distributions set status = 'confirmed' where transaction_hash is not null;
alter table public.demo_distributions add constraint demo_distribution_status check (status in ('preparing', 'prepared', 'confirmed'));
alter table public.demo_distributions add constraint demo_distribution_consistency check (
  (status = 'preparing' and signed_xdr is null and transaction_hash is null)
  or (status = 'prepared' and signed_xdr is not null and transaction_hash is not null)
  or (status = 'confirmed' and transaction_hash is not null)
);

create or replace function public.create_demo_session(session_id uuid, session_customer_public_key text, session_token_hash text, session_request_fingerprint text, session_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare existing_session public.demo_sessions;
begin
  perform pg_advisory_xact_lock(hashtext('stellar-invoice:demo-sessions'));
  delete from public.demo_sessions where created_at < now() - interval '30 days' and not exists (
    select 1 from public.demo_distributions where demo_distributions.customer_public_key = demo_sessions.customer_public_key
  );
  select * into existing_session from public.demo_sessions where customer_public_key = session_customer_public_key for update;
  if existing_session.id is not null then
    if exists (select 1 from public.demo_distributions where customer_public_key = session_customer_public_key) then
      raise exception 'Demo wallet has already received its BRLT allowance';
    end if;
    update public.demo_sessions set token_hash = session_token_hash, request_fingerprint = session_request_fingerprint,
      expires_at = session_expires_at, consumed_at = null where id = existing_session.id;
    return;
  end if;
  if (select count(*) from public.demo_sessions where created_at >= date_trunc('day', now())) >= 100 then raise exception 'Daily demo session limit exceeded'; end if;
  if (select count(*) from public.demo_sessions where request_fingerprint = session_request_fingerprint and created_at >= date_trunc('day', now())) >= 3 then raise exception 'Demo request limit exceeded'; end if;
  if session_expires_at <= now() or session_expires_at > now() + interval '11 minutes'
    or session_customer_public_key !~ '^G[A-Z2-7]{55}$' or session_token_hash !~ '^[a-f0-9]{64}$'
    or session_request_fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'Invalid demo session'; end if;
  insert into public.demo_sessions(id, customer_public_key, token_hash, request_fingerprint, expires_at)
  values (session_id, session_customer_public_key, session_token_hash, session_request_fingerprint, session_expires_at);
end; $$;

create or replace function public.reserve_demo_distribution(session_token_hash text, distribution_attempt_key uuid, requested_at timestamptz)
returns public.demo_distributions language plpgsql security definer set search_path = '' as $$
declare session_record public.demo_sessions; distribution_record public.demo_distributions;
begin
  select * into session_record from public.demo_sessions where token_hash = session_token_hash for update;
  if session_record.id is null then raise exception 'Demo session is invalid or expired'; end if;
  select * into distribution_record from public.demo_distributions where customer_public_key = session_record.customer_public_key for update;
  if distribution_record.id is not null then
    if distribution_record.status = 'preparing' and distribution_record.signed_xdr is null
      and distribution_record.updated_at <= requested_at - interval '2 minutes' then
      update public.demo_distributions set attempt_key = distribution_attempt_key, updated_at = requested_at
      where id = distribution_record.id returning * into distribution_record;
    end if;
    return distribution_record;
  end if;
  if session_record.consumed_at is not null or session_record.expires_at <= requested_at then raise exception 'Demo session is invalid or expired'; end if;
  update public.demo_sessions set consumed_at = requested_at where id = session_record.id;
  insert into public.demo_distributions(customer_public_key, status, attempt_key, updated_at)
  values (session_record.customer_public_key, 'preparing', distribution_attempt_key, requested_at) returning * into distribution_record;
  return distribution_record;
end; $$;

create or replace function public.store_demo_distribution_xdr(distribution_customer_public_key text, distribution_attempt_key uuid, distribution_signed_xdr text, distribution_transaction_hash text)
returns public.demo_distributions language plpgsql security definer set search_path = '' as $$
declare distribution_record public.demo_distributions;
begin
  if char_length(distribution_signed_xdr) not between 100 and 10000 or distribution_signed_xdr !~ '^[A-Za-z0-9+/=]+$'
    or distribution_transaction_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid prepared demo distribution'; end if;
  update public.demo_distributions set status = 'prepared', signed_xdr = distribution_signed_xdr,
    transaction_hash = distribution_transaction_hash, updated_at = now()
  where customer_public_key = distribution_customer_public_key and status = 'preparing'
    and attempt_key = distribution_attempt_key and signed_xdr is null returning * into distribution_record;
  if distribution_record.id is null then raise exception 'Demo distribution reservation was lost'; end if;
  return distribution_record;
end; $$;

create or replace function public.complete_demo_distribution(distribution_customer_public_key text, distribution_transaction_hash text)
returns public.demo_distributions language plpgsql security definer set search_path = '' as $$
declare distribution_record public.demo_distributions;
begin
  update public.demo_distributions set status = 'confirmed', updated_at = now()
  where customer_public_key = distribution_customer_public_key and transaction_hash = distribution_transaction_hash
    and status in ('prepared', 'confirmed') returning * into distribution_record;
  if distribution_record.id is null then raise exception 'Prepared demo distribution was not found'; end if;
  return distribution_record;
end; $$;

revoke execute on function public.create_demo_session(uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.reserve_demo_distribution(text, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.store_demo_distribution_xdr(text, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.complete_demo_distribution(text, text) from public, anon, authenticated;
grant execute on function public.create_demo_session(uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.reserve_demo_distribution(text, uuid, timestamptz) to service_role;
grant execute on function public.store_demo_distribution_xdr(text, uuid, text, text) to service_role;
grant execute on function public.complete_demo_distribution(text, text) to service_role;
