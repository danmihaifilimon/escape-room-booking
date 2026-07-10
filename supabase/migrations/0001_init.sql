-- Booking schema.
--
-- The load-bearing idea: overlapping bookings are prevented by a Postgres
-- exclusion constraint, not by application code. A "is this slot free?" query
-- followed by an INSERT is a time-of-check-to-time-of-use race — two users can
-- both read "free" before either writes. The constraint is evaluated atomically
-- during the INSERT, so the second writer always loses with SQLSTATE 23P01,
-- and there is no code path (API, SQL console, future script) that can bypass it.

create extension if not exists btree_gist;  -- lets `resource_id with =` sit beside `slot with &&`
create extension if not exists citext;

create type block_kind   as enum ('booking', 'block');
create type block_status as enum ('confirmed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Resources: an escape room, a coach, anything bookable as an exclusive slot.
-- ---------------------------------------------------------------------------
create table resources (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  timezone     text not null default 'Europe/Bucharest',
  slot_minutes int  not null default 60 check (slot_minutes between 5 and 480),
  capacity     int  not null default 6  check (capacity >= 1),
  lead_minutes int  not null default 60 check (lead_minutes >= 0),
  horizon_days int  not null default 60 check (horizon_days between 1 and 365),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),

  -- A timezone typo ('Europe/Bucarest') would silently shift every slot.
  constraint timezone_is_real check (now() at time zone timezone is not null)
);

-- ---------------------------------------------------------------------------
-- Opening hours, expressed in the resource's local time (never UTC).
-- ---------------------------------------------------------------------------
create table business_hours (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references resources(id) on delete cascade,
  weekday     int  not null check (weekday between 0 and 6),  -- 0 = Sunday, matching JS getDay()
  opens_at    time not null,
  closes_at   time not null,
  check (closes_at > opens_at),
  unique (resource_id, weekday, opens_at)
);

-- ---------------------------------------------------------------------------
-- Bookings and admin blocks share one table so that a single exclusion
-- constraint covers both: a constraint cannot span two tables, and if closures
-- lived elsewhere, "is this day blocked?" would become a racy check in code.
-- ---------------------------------------------------------------------------
create table time_blocks (
  id             uuid primary key default gen_random_uuid(),
  resource_id    uuid not null references resources(id) on delete cascade,
  kind           block_kind   not null default 'booking',
  status         block_status not null default 'confirmed',
  slot           tstzrange    not null,

  customer_name  text,
  customer_email citext,
  party_size     int check (party_size >= 1),
  notes          text,
  reason         text,                                    -- only meaningful for kind = 'block'
  cancel_token   uuid not null default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  cancelled_at   timestamptz,

  constraint slot_is_bounded check (
    not lower_inf(slot) and not upper_inf(slot) and not isempty(slot)
  ),

  -- tstzrange is a continuous type, so Postgres does NOT normalise bounds the
  -- way it does for daterange. Without this, someone could insert [10:00,11:00]
  -- (inclusive upper) and it would overlap [11:00,12:00) — adjacent slots would
  -- start colliding. Force the half-open form that makes adjacency work.
  constraint slot_is_half_open check (lower_inc(slot) and not upper_inc(slot)),

  constraint booking_has_customer check (
    kind <> 'booking'
    or (customer_name is not null and customer_email is not null and party_size is not null)
  ),
  constraint cancelled_has_timestamp check (
    (status = 'cancelled') = (cancelled_at is not null)
  ),

  -- The whole point. Cancelled rows are excluded, so cancelling frees the slot
  -- without deleting history.
  constraint no_overlapping_blocks exclude using gist (
    resource_id with =,
    slot        with &&
  ) where (status = 'confirmed')
);

-- The exclusion constraint already builds a partial GiST index on
-- (resource_id, slot) WHERE status = 'confirmed' — which is exactly the
-- predicate availability lookups use. A second index would be dead weight.

create index time_blocks_email_idx on time_blocks (customer_email) where kind = 'booking';

-- ---------------------------------------------------------------------------
-- Admin flag, keyed to Supabase auth.
-- ---------------------------------------------------------------------------
create table profiles (
  id       uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false
);

-- SECURITY DEFINER matters here: the policy on `profiles` calls this function,
-- and the function reads `profiles`. Running as the owner bypasses RLS on that
-- read, which is what stops the policy from recursing into itself.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select p.is_admin from profiles p where p.id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Availability is derived, never stored. A materialised slot table would need a
-- cron to extend it and would drift whenever opening hours change.
--
-- Split in two on purpose: slot_grid is the pure calendar-to-instants mapping
-- (deterministic, so DST behaviour is testable at any date), while
-- available_slots layers on the now()-relative lead/horizon filters and the
-- free/busy flag.
-- ---------------------------------------------------------------------------
create or replace function slot_grid(p_slug text, p_from date, p_to date)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select * from resources where slug = p_slug and is_active
  ),
  spans as (
    select
      -- `date + time` is a naive timestamp; AT TIME ZONE reads it as local time
      -- in the venue's zone and yields the correct UTC instant. Stepping by an
      -- interval over timestamptz advances *absolute* time, so a day that is
      -- 23h or 25h long yields correspondingly fewer or more slots.
      (d::date + bh.opens_at)  at time zone r.timezone as opens,
      (d::date + bh.closes_at) at time zone r.timezone as closes,
      r.slot_minutes
    from r
    cross join generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
    join business_hours bh
      on bh.resource_id = r.id
     and bh.weekday = extract(dow from d)::int
  )
  select s, s + make_interval(mins => spans.slot_minutes)
  from spans
  cross join lateral generate_series(
    spans.opens,
    spans.closes - make_interval(mins => spans.slot_minutes),
    make_interval(mins => spans.slot_minutes)
  ) s
  order by 1;
$$;

-- Returns only time ranges and a free/busy flag: the public calendar must never
-- learn *who* booked a slot. This is why anon has no direct access to
-- time_blocks at all.
create or replace function available_slots(p_slug text, p_from date, p_to date)
returns table (starts_at timestamptz, ends_at timestamptz, is_free boolean)
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select * from resources where slug = p_slug and is_active
  )
  select
    g.starts_at,
    g.ends_at,
    not exists (
      select 1
      from time_blocks b
      where b.resource_id = r.id
        and b.status = 'confirmed'
        and b.slot && tstzrange(g.starts_at, g.ends_at, '[)')
    ) as is_free
  from r, slot_grid(p_slug, p_from, p_to) g
  where g.starts_at >= now() + make_interval(mins => r.lead_minutes)
    and g.starts_at <  now() + make_interval(days => r.horizon_days)
  order by g.starts_at;
$$;

-- ---------------------------------------------------------------------------
-- The only way the public may write. Validation lives here because anything
-- enforced only in React is a suggestion, not a rule.
--
-- Note what this function does NOT do: check whether the slot is already taken.
-- That check would be a race. The exclusion constraint decides, atomically.
-- ---------------------------------------------------------------------------
create or replace function create_booking(
  p_slug       text,
  p_start      timestamptz,
  p_name       text,
  p_email      text,
  p_party_size int,
  p_notes      text default null
)
returns time_blocks
language plpgsql
security definer
set search_path = public
as $$
declare
  r         resources%rowtype;
  v_local   date;
  v_row     time_blocks%rowtype;
begin
  select * into r from resources where slug = p_slug and is_active;
  if not found then
    raise exception 'unknown_resource' using errcode = '45001';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'invalid_name' using errcode = '45002';
  end if;

  if p_party_size is null or p_party_size < 1 or p_party_size > r.capacity then
    raise exception 'invalid_party_size' using errcode = '45002';
  end if;

  -- Asking availability whether this exact instant is a real slot start folds
  -- four checks into one: aligned to the grid, inside opening hours, past the
  -- lead time, inside the booking horizon.
  v_local := (p_start at time zone r.timezone)::date;
  if not exists (
    select 1 from available_slots(r.slug, v_local, v_local) s
    where s.starts_at = p_start
  ) then
    raise exception 'slot_not_bookable' using errcode = '45003';
  end if;

  insert into time_blocks (resource_id, kind, status, slot, customer_name, customer_email, party_size, notes)
  values (
    r.id,
    'booking',
    'confirmed',
    tstzrange(p_start, p_start + make_interval(mins => r.slot_minutes), '[)'),
    btrim(p_name),
    lower(btrim(p_email))::citext,
    p_party_size,
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Cancelling frees the slot (the exclusion constraint ignores cancelled rows).
create or replace function cancel_booking(p_token uuid)
returns time_blocks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row time_blocks%rowtype;
begin
  update time_blocks
     set status = 'cancelled', cancelled_at = now()
   where cancel_token = p_token
     and kind = 'booking'
     and status = 'confirmed'
  returning * into v_row;

  if not found then
    raise exception 'booking_not_found' using errcode = '45004';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security.
--
-- The trap this avoids: a `for select using (true)` policy on time_blocks would
-- make the public calendar work — and publish every customer's name and email.
-- anon therefore gets no table access at all, only the two functions above.
-- ---------------------------------------------------------------------------
alter table resources      enable row level security;
alter table business_hours enable row level security;
alter table time_blocks    enable row level security;
alter table profiles       enable row level security;

create policy resources_public_read on resources
  for select using (is_active);

create policy hours_public_read on business_hours
  for select using (true);

create policy blocks_admin_all on time_blocks
  for all using (is_admin()) with check (is_admin());

create policy profiles_read_own on profiles
  for select using (id = auth.uid() or is_admin());

-- GRANTs and RLS are two separate gates: a policy only filters rows the role is
-- already allowed to touch. Supabase's defaults hand anon/authenticated broad
-- table access and lean entirely on RLS, so state the privileges explicitly
-- rather than inheriting them.
grant select on resources, business_hours to anon, authenticated;

-- anon may never reach customer rows, not even to count them.
revoke all on time_blocks, profiles from anon;

-- Admins operate on the table directly (ergonomic listing/filtering through
-- PostgREST); the policy above is what actually restricts this to is_admin().
-- A signed-in non-admin has the privilege but matches zero rows.
grant select, insert, update on time_blocks to authenticated;
grant select on profiles to authenticated;

-- Postgres grants EXECUTE to PUBLIC by default, so listing grants without first
-- revoking would restrict nothing. Revoke the lot, then hand back exactly the
-- three entry points the public is allowed to call.
revoke execute on all functions in schema public from public;

grant execute on function available_slots(text, date, date)                        to anon, authenticated;
grant execute on function create_booking(text, timestamptz, text, text, int, text) to anon, authenticated;
grant execute on function cancel_booking(uuid)                                     to anon, authenticated;

-- Not a public entry point, but the RLS policies below call it as the querying
-- role, so that role needs EXECUTE or policy evaluation errors out.
grant execute on function is_admin() to anon, authenticated;

-- slot_grid is deliberately absent: available_slots reaches it as the function
-- owner, and nothing outside needs it.
