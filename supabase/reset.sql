-- Drops everything 0001_init.sql creates, so it can be re-run from scratch.
-- Safe to run even if the previous apply only got partway through — every
-- statement is `if exists`.
--
-- Does NOT touch auth.users or anything outside this schema.

-- Tables first: their RLS policies (e.g. blocks_admin_all) depend on
-- is_admin(), so dropping the function first fails unless the tables (and
-- with them, the policies) are already gone.
drop table if exists time_blocks cascade;
drop table if exists business_hours cascade;
drop table if exists profiles cascade;
drop table if exists resources cascade;

drop function if exists cancel_booking(uuid);
drop function if exists create_booking(text, timestamptz, text, text, int, text);
drop function if exists available_slots(text, date, date);
drop function if exists slot_grid(text, date, date);
drop function if exists is_admin();

drop type if exists block_status;
drop type if exists block_kind;
