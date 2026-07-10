-- Slot generation, including the two days a year when a local day is not
-- 24 hours long. Run with `psql -v ON_ERROR_STOP=1`.

\set QUIET on
set client_min_messages = warning;

create or replace function _assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not p_cond then raise exception 'assertion failed: %', p_msg; end if;
end;
$$;

-- A resource open through the night, so its hours straddle the 03:00 DST switch.
insert into resources (slug, name, timezone, slot_minutes, capacity, horizon_days)
values ('night', 'Night Room', 'Europe/Bucharest', 60, 2, 365);

insert into business_hours (resource_id, weekday, opens_at, closes_at)
values ((select id from resources where slug = 'night'), 0, time '00:00', time '06:00');

-- Self-check the fixture dates before trusting anything built on them.
select _assert(extract(dow from date '2027-03-21')::int = 0, '2027-03-21 should be a Sunday');
select _assert(extract(dow from date '2027-03-28')::int = 0, '2027-03-28 should be a Sunday');
select _assert(extract(dow from date '2027-10-31')::int = 0, '2027-10-31 should be a Sunday');

-- ---------------------------------------------------------------------------
-- A normal 24h day: 00:00-06:00 in 1h steps = 6 slots.
-- ---------------------------------------------------------------------------
select _assert(
  (select count(*) from slot_grid('night', '2027-03-21', '2027-03-21')) = 6,
  'normal Sunday should yield 6 slots'
);

-- ---------------------------------------------------------------------------
-- Spring forward: at 03:00 local the clock jumps to 04:00, so 03:00 never
-- happens. The 00:00-06:00 window is only 5 real hours -> 5 slots, and none of
-- them may start at a local 03:00.
-- ---------------------------------------------------------------------------
select _assert(
  (select count(*) from slot_grid('night', '2027-03-28', '2027-03-28')) = 5,
  'spring-forward Sunday should yield 5 slots, not 6'
);

select _assert(
  not exists (
    select 1 from slot_grid('night', '2027-03-28', '2027-03-28')
    where extract(hour from starts_at at time zone 'Europe/Bucharest')::int = 3
  ),
  'no slot may start at a local 03:00 on the spring-forward day'
);

-- The last slot must still end at local 06:00 despite the missing hour.
select _assert(
  (select max(ends_at) at time zone 'Europe/Bucharest'
     from slot_grid('night', '2027-03-28', '2027-03-28'))::time = time '06:00',
  'spring-forward day should still close at local 06:00'
);

-- ---------------------------------------------------------------------------
-- Fall back: 03:00 local happens twice, so the window is 7 real hours.
-- ---------------------------------------------------------------------------
select _assert(
  (select count(*) from slot_grid('night', '2027-10-31', '2027-10-31')) = 7,
  'fall-back Sunday should yield 7 slots, not 6'
);

-- Every generated slot must be exactly slot_minutes of real time, DST or not.
select _assert(
  not exists (
    select 1 from slot_grid('night', '2027-10-31', '2027-10-31')
    where ends_at - starts_at <> interval '1 hour'
  ),
  'every slot must span exactly one real hour'
);

-- ---------------------------------------------------------------------------
-- The ordinary room: 10:00-20:00, 60 min -> 10 slots/day, none outside hours.
-- ---------------------------------------------------------------------------
select _assert(
  (select count(*) from slot_grid('room-a', '2030-05-06', '2030-05-06')) = 10,
  'room-a should yield 10 slots on a normal day'
);

select _assert(
  not exists (
    select 1 from slot_grid('room-a', '2030-05-06', '2030-05-06')
    where (starts_at at time zone 'Europe/Bucharest')::time <  time '10:00'
       or (ends_at   at time zone 'Europe/Bucharest')::time >  time '20:00'
  ),
  'no slot may fall outside opening hours'
);

-- A day with no business_hours row yields nothing rather than erroring.
insert into resources (slug, name) values ('weekday-only', 'Weekday Only');
insert into business_hours (resource_id, weekday, opens_at, closes_at)
select id, 1, time '09:00', time '17:00' from resources where slug = 'weekday-only';

select _assert(
  (select count(*) from slot_grid('weekday-only', '2030-05-05', '2030-05-05')) = 0,  -- a Sunday
  'a closed day should yield zero slots'
);

-- ---------------------------------------------------------------------------
-- available_slots layers freshness on top of the grid.
-- ---------------------------------------------------------------------------

-- Nothing within lead_minutes of now, and nothing past the horizon.
select _assert(
  not exists (
    select 1 from available_slots('room-a', current_date, current_date + 90)
    where starts_at < now() + interval '60 minutes'
  ),
  'available_slots must not offer anything inside the lead time'
);

select _assert(
  not exists (
    select 1 from available_slots('room-a', current_date, current_date + 90)
    where starts_at >= now() + interval '60 days'
  ),
  'available_slots must not offer anything past the horizon'
);

-- is_free must reflect a confirmed booking, and flip back when it is cancelled.
do $$
declare
  v_start timestamptz;
begin
  select starts_at into v_start
  from available_slots('room-a', current_date + 2, current_date + 2)
  where is_free limit 1;

  perform _assert(v_start is not null, 'expected a free slot two days out');

  insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
  values (_rid('room-a'), 'booking', tstzrange(v_start, v_start + interval '1 hour', '[)'),
          'Test', 't@example.com', 1);

  perform _assert(
    (select not is_free from available_slots('room-a', current_date + 2, current_date + 2)
      where starts_at = v_start),
    'a booked slot must report is_free = false'
  );

  update time_blocks set status = 'cancelled', cancelled_at = now()
   where resource_id = _rid('room-a') and lower(slot) = v_start;

  perform _assert(
    (select is_free from available_slots('room-a', current_date + 2, current_date + 2)
      where starts_at = v_start),
    'a cancelled booking must free the slot again'
  );
end $$;

\echo '  --- availability suite passed ---'
