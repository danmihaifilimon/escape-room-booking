-- Local-only: stubs the pieces Supabase provides (auth schema, roles) so the
-- real migration can run against a plain Postgres for testing. Never applied
-- to Supabase itself.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid()
);

-- Supabase derives this from the request JWT. Locally we drive it with a GUC
-- so tests can impersonate a user: `set local request.jwt.claim.sub = '<uuid>'`.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth   to anon, authenticated;
