-- Exercises the exclusion constraint and the range-bound checks.
-- Run with `psql -v ON_ERROR_STOP=1`; any failed assertion aborts the file.

\set QUIET on
set client_min_messages = warning;

insert into resources (slug, name, timezone, slot_minutes, capacity)
values ('room-a', 'Room A', 'Europe/Bucharest', 60, 6),
       ('room-b', 'Room B', 'Europe/Bucharest', 60, 4);

-- Mon..Sun 10:00-20:00 for both rooms
insert into business_hours (resource_id, weekday, opens_at, closes_at)
select r.id, wd, time '10:00', time '20:00'
from resources r, generate_series(0, 6) wd;

create or replace function _rid(p_slug text) returns uuid
language sql stable as $$ select id from resources where slug = p_slug $$;

create or replace function _slot(p_start text, p_hours int default 1) returns tstzrange
language sql stable as $$
  select tstzrange(
    p_start::timestamptz,
    p_start::timestamptz + make_interval(hours => p_hours),
    '[)'
  );
$$;

-- Asserts that `sql` fails with the given SQLSTATE.
create or replace function _expect_error(p_sql text, p_sqlstate text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected SQLSTATE % but the statement succeeded: %', p_sqlstate, p_sql;
exception
  when others then
    if sqlstate = 'P0001' and sqlerrm like 'expected SQLSTATE%' then
      raise;  -- our own "it succeeded" complaint, don't swallow it
    end if;
    if sqlstate <> p_sqlstate then
      raise exception 'expected SQLSTATE %, got % (%) for: %', p_sqlstate, sqlstate, sqlerrm, p_sql;
    end if;
end;
$$;

-- ---------------------------------------------------------------------------
do $$ begin raise notice '1. a plain booking inserts'; end $$;

insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
values (_rid('room-a'), 'booking', _slot('2030-03-11 10:00+02'), 'Ana', 'ana@example.com', 2);

-- ---------------------------------------------------------------------------
do $$ begin raise notice '2. ADJACENT slots do NOT collide ([) half-open bounds)'; end $$;

insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
values (_rid('room-a'), 'booking', _slot('2030-03-11 11:00+02'), 'Bogdan', 'b@example.com', 2);

do $$
begin
  if (select count(*) from time_blocks where resource_id = _rid('room-a')) <> 2 then
    raise exception 'adjacent slots should both exist';
  end if;
end $$;

-- ---------------------------------------------------------------------------
do $$ begin raise notice '3. IDENTICAL slot is rejected (23P01)'; end $$;

select _expect_error($sql$
  insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
  values (_rid('room-a'), 'booking', _slot('2030-03-11 10:00+02'), 'Dana', 'd@example.com', 2)
$sql$, '23P01');

-- ---------------------------------------------------------------------------
do $$ begin raise notice '4. PARTIAL overlap is rejected (30 min in)'; end $$;

select _expect_error($sql$
  insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
  values (_rid('room-a'), 'booking',
          tstzrange('2030-03-11 10:30+02'::timestamptz, '2030-03-11 11:30+02'::timestamptz, '[)'),
          'Dana', 'd@example.com', 2)
$sql$, '23P01');

-- ---------------------------------------------------------------------------
do $$ begin raise notice '5. ENVELOPING slot is rejected (09:00-13:00 swallows both)'; end $$;

select _expect_error($sql$
  insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
  values (_rid('room-a'), 'booking',
          tstzrange('2030-03-11 09:00+02'::timestamptz, '2030-03-11 13:00+02'::timestamptz, '[)'),
          'Dana', 'd@example.com', 2)
$sql$, '23P01');

-- ---------------------------------------------------------------------------
do $$ begin raise notice '6. the SAME slot on a DIFFERENT resource is fine'; end $$;

insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
values (_rid('room-b'), 'booking', _slot('2030-03-11 10:00+02'), 'Elena', 'e@example.com', 2);

-- ---------------------------------------------------------------------------
do $$ begin raise notice '7. an admin BLOCK also excludes bookings (one table, one constraint)'; end $$;

insert into time_blocks (resource_id, kind, slot, reason)
values (_rid('room-a'), 'block', _slot('2030-03-11 15:00+02', 2), 'maintenance');

select _expect_error($sql$
  insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
  values (_rid('room-a'), 'booking', _slot('2030-03-11 16:00+02'), 'Fane', 'f@example.com', 2)
$sql$, '23P01');

-- ---------------------------------------------------------------------------
do $$ begin raise notice '8. CANCELLING frees the slot'; end $$;

update time_blocks
   set status = 'cancelled', cancelled_at = now()
 where resource_id = _rid('room-a') and lower(slot) = '2030-03-11 10:00+02'::timestamptz;

insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
values (_rid('room-a'), 'booking', _slot('2030-03-11 10:00+02'), 'Gigi', 'g@example.com', 2);

-- ---------------------------------------------------------------------------
do $$ begin raise notice '9. an INCLUSIVE upper bound is rejected (would break adjacency)'; end $$;

select _expect_error($sql$
  insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
  values (_rid('room-b'), 'booking',
          tstzrange('2030-03-12 10:00+02'::timestamptz, '2030-03-12 11:00+02'::timestamptz, '[]'),
          'Horia', 'h@example.com', 2)
$sql$, '23514');

-- ---------------------------------------------------------------------------
do $$ begin raise notice '10. an UNBOUNDED slot is rejected'; end $$;

select _expect_error($sql$
  insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
  values (_rid('room-b'), 'booking',
          tstzrange('2030-03-12 10:00+02'::timestamptz, null, '[)'),
          'Ion', 'i@example.com', 2)
$sql$, '23514');

-- ---------------------------------------------------------------------------
do $$ begin raise notice '11. a booking without customer details is rejected'; end $$;

select _expect_error($sql$
  insert into time_blocks (resource_id, kind, slot)
  values (_rid('room-b'), 'booking', _slot('2030-03-13 10:00+02'))
$sql$, '23514');

-- ---------------------------------------------------------------------------
do $$ begin raise notice '12. a bad timezone on a resource is rejected'; end $$;

select _expect_error($sql$
  insert into resources (slug, name, timezone) values ('bad', 'Bad', 'Europe/Bucarest')
$sql$, '22023');

\echo '  --- constraint suite passed ---'
