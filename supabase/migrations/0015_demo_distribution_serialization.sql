create table public.demo_distribution_mutex (
  singleton boolean primary key default true check (singleton),
  owner_key uuid,
  lease_expires_at timestamptz
);
insert into public.demo_distribution_mutex(singleton) values (true);
alter table public.demo_distribution_mutex enable row level security;
revoke all on public.demo_distribution_mutex from public, anon, authenticated;
grant select, update on public.demo_distribution_mutex to service_role;

create or replace function public.acquire_demo_distribution_lock(lock_owner uuid, requested_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare mutex public.demo_distribution_mutex;
begin
  select * into mutex from public.demo_distribution_mutex where singleton = true for update;
  if mutex.owner_key is not null and mutex.owner_key <> lock_owner and mutex.lease_expires_at > requested_at then
    raise exception 'Another demo distribution is in progress';
  end if;
  update public.demo_distribution_mutex set owner_key = lock_owner, lease_expires_at = requested_at + interval '2 minutes'
  where singleton = true;
end;
$$;

create or replace function public.release_demo_distribution_lock(lock_owner uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.demo_distribution_mutex set owner_key = null, lease_expires_at = null
  where singleton = true and owner_key = lock_owner;
$$;

create or replace function public.reset_expired_demo_distribution(
  distribution_customer_public_key text,
  expected_transaction_hash text,
  replacement_attempt_key uuid
)
returns public.demo_distributions
language plpgsql
security definer
set search_path = ''
as $$
declare distribution_record public.demo_distributions;
begin
  update public.demo_distributions set status = 'preparing', signed_xdr = null, transaction_hash = null,
    attempt_key = replacement_attempt_key, updated_at = now()
  where customer_public_key = distribution_customer_public_key and status = 'prepared'
    and transaction_hash = expected_transaction_hash
  returning * into distribution_record;
  if distribution_record.id is null then raise exception 'Prepared demo distribution could not be reset'; end if;
  return distribution_record;
end;
$$;

revoke execute on function public.acquire_demo_distribution_lock(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.release_demo_distribution_lock(uuid) from public, anon, authenticated;
revoke execute on function public.reset_expired_demo_distribution(text, text, uuid) from public, anon, authenticated;
grant execute on function public.acquire_demo_distribution_lock(uuid, timestamptz) to service_role;
grant execute on function public.release_demo_distribution_lock(uuid) to service_role;
grant execute on function public.reset_expired_demo_distribution(text, text, uuid) to service_role;
