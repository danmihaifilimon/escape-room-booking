-- create_booking / cancel_booking validation, and the privilege boundary.
-- Run with `psql -v ON_ERROR_STOP=1`.

\set QUIET on
set client_min_messages = warning;

-- A slot start that is genuinely bookable: tomorrow at 12:00 local.
create or replace function _tomorrow_noon() returns timestamptz
language sql stable as $$
  select ((current_date + 1) + time '12:00') at time zone 'Europe/Bucharest';
$$;

-- ---------------------------------------------------------------------------
do $$ begin raise notice 'create_booking: happy path'; end $$;

do $$
declare v time_blocks%rowtype;
begin
  v := create_booking('room-a', _tomorrow_noon(), '  Ana Pop ', 'Ana.Pop@EXAMPLE.com', 3, '  ');
  perform _assert(v.status = 'confirmed',              'status should be confirmed');
  perform _assert(v.kind   = 'booking',                'kind should be booking');
  perform _assert(v.customer_name = 'Ana Pop',         'name should be trimmed');
  perform _assert(v.customer_email = 'ana.pop@example.com', 'email should be lowercased');
  perform _assert(v.notes is null,                     'blank notes should normalise to null');
  perform _assert(lower(v.slot) = _tomorrow_noon(),    'slot should start where asked');
  perform _assert(upper(v.slot) = _tomorrow_noon() + interval '1 hour', 'slot should be 1h');
  perform _assert(v.cancel_token is not null,          'a cancel token should be issued');
end $$;

-- citext: a differently-cased email finds the same row
select _assert(
  exists (select 1 from time_blocks where customer_email = 'ANA.POP@example.COM'),
  'citext should make email lookup case-insensitive'
);

-- ---------------------------------------------------------------------------
do $$ begin raise notice 'create_booking: the same slot twice -> 23P01'; end $$;

select _expect_error(
  $$ select create_booking('room-a', _tomorrow_noon(), 'Bob', 'b@example.com', 2) $$,
  '23P01'
);

-- ---------------------------------------------------------------------------
do $$ begin raise notice 'create_booking: rejects unaligned / past / distant / oversized'; end $$;

-- 12:30 is not on the hourly grid
select _expect_error(
  $$ select create_booking('room-a', _tomorrow_noon() + interval '30 minutes', 'B', 'b@e.com', 2) $$,
  '45003'
);

-- yesterday
select _expect_error(
  $$ select create_booking('room-a', _tomorrow_noon() - interval '2 days', 'B', 'b@e.com', 2) $$,
  '45003'
);

-- past the 60-day horizon
select _expect_error(
  $$ select create_booking('room-a', _tomorrow_noon() + interval '90 days', 'B', 'b@e.com', 2) $$,
  '45003'
);

-- 08:00 is outside the 10:00-20:00 window
select _expect_error(
  $$ select create_booking('room-a',
       ((current_date + 1) + time '08:00') at time zone 'Europe/Bucharest', 'B', 'b@e.com', 2) $$,
  '45003'
);

-- room-a seats 6
select _expect_error(
  $$ select create_booking('room-a', _tomorrow_noon() + interval '1 hour', 'B', 'b@e.com', 99) $$,
  '45002'
);

select _expect_error(
  $$ select create_booking('room-a', _tomorrow_noon() + interval '1 hour', '   ', 'b@e.com', 2) $$,
  '45002'
);

select _expect_error(
  $$ select create_booking('nope', _tomorrow_noon() + interval '1 hour', 'B', 'b@e.com', 2) $$,
  '45001'
);

-- ---------------------------------------------------------------------------
do $$ begin raise notice 'cancel_booking: frees the slot, and is not replayable'; end $$;

do $$
declare
  v_token uuid;
begin
  select cancel_token into v_token
  from time_blocks
  where lower(slot) = _tomorrow_noon() and status = 'confirmed';

  perform cancel_booking(v_token);

  perform _assert(
    (select is_free from available_slots('room-a', current_date + 1, current_date + 1)
      where starts_at = _tomorrow_noon()),
    'cancelling should free the slot'
  );

  -- the freed slot can be rebooked
  perform create_booking('room-a', _tomorrow_noon(), 'Carol', 'c@example.com', 2);

  -- replaying the old token must not cancel the new booking
  perform _expect_error(
    format('select cancel_booking(%L)', v_token),
    '45004'
  );

  perform _assert(
    (select count(*) from time_blocks
      where lower(slot) = _tomorrow_noon() and status = 'confirmed') = 1,
    'the new booking must survive a replayed cancel token'
  );
end $$;

-- ---------------------------------------------------------------------------
do $$ begin raise notice 'RLS: anon may not read customer data'; end $$;

-- Build an admin and a plain user to switch into.
insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');
insert into profiles (id, is_admin) values
  ('11111111-1111-1111-1111-111111111111', true),
  ('22222222-2222-2222-2222-222222222222', false);

do $$
begin
  set local role anon;

  -- No table privilege at all: not filtered rows, an outright refusal.
  perform _expect_error($q$ select * from time_blocks $q$,        '42501');
  perform _expect_error($q$ select count(*) from time_blocks $q$, '42501');
  perform _expect_error($q$ select * from profiles $q$,           '42501');

  -- ...but the public surface works.
  perform _assert((select count(*) from resources where slug = 'room-a') = 1,
                  'anon should read active resources');
  perform _assert((select count(*) from available_slots('room-a', current_date, current_date + 3)) > 0,
                  'anon should read availability');

  reset role;
end $$;

do $$ begin raise notice 'RLS: anon may still create a booking (through the RPC only)'; end $$;

do $$
declare v_start timestamptz;
begin
  select starts_at into v_start
  from available_slots('room-a', current_date + 3, current_date + 3) where is_free limit 1;

  set local role anon;
  perform create_booking('room-a', v_start, 'Anon User', 'anon@example.com', 2);
  reset role;

  perform _assert(
    (select count(*) from time_blocks where customer_email = 'anon@example.com') = 1,
    'anon should be able to book via the security-definer RPC'
  );
end $$;

-- ---------------------------------------------------------------------------
do $$ begin raise notice 'RLS: signed-in non-admin sees zero rows; admin sees all'; end $$;

do $$
declare
  v_total int;
  v_seen  int;
begin
  select count(*) into v_total from time_blocks;
  perform _assert(v_total > 0, 'fixture should have bookings');

  -- plain authenticated user: has the privilege, matches no rows
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  select count(*) into v_seen from time_blocks;
  reset role;
  perform _assert(v_seen = 0, format('non-admin should see 0 rows, saw %s', v_seen));

  -- admin
  perform set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;
  select count(*) into v_seen from time_blocks;
  reset role;
  perform _assert(v_seen = v_total, format('admin should see all %s rows, saw %s', v_total, v_seen));
end $$;

do $$ begin raise notice 'RLS: a non-admin cannot cancel someone else''s booking by UPDATE'; end $$;

do $$
declare v_updated int;
begin
  perform set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
  set local role authenticated;
  update time_blocks set status = 'cancelled', cancelled_at = now() where status = 'confirmed';
  get diagnostics v_updated = row_count;
  reset role;
  perform _assert(v_updated = 0, format('non-admin update should touch 0 rows, touched %s', v_updated));
end $$;

\echo '  --- rpc + rls suite passed ---'
