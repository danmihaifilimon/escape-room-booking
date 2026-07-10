-- Demo data. Safe to re-run: resources are keyed by slug.

insert into resources (slug, name, timezone, slot_minutes, capacity, lead_minutes, horizon_days)
values ('escape-cluj', 'Escape Room — Cluj', 'Europe/Bucharest', 60, 6, 60, 60)
on conflict (slug) do nothing;

-- Tue–Sun 10:00–20:00, closed Mondays. (0 = Sunday, matching JS getDay().)
insert into business_hours (resource_id, weekday, opens_at, closes_at)
select r.id, wd, time '10:00', time '20:00'
from resources r
cross join (values (0), (2), (3), (4), (5), (6)) as w(wd)
where r.slug = 'escape-cluj'
on conflict (resource_id, weekday, opens_at) do nothing;

-- Promote yourself to admin after signing up through Supabase Auth:
--
--   insert into profiles (id, is_admin)
--   select id, true from auth.users where email = 'you@example.com'
--   on conflict (id) do update set is_admin = true;
