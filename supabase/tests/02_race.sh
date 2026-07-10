#!/usr/bin/env bash
# Two transactions race for one slot. The exclusion constraint must serialise
# them: the loser blocks until the winner commits, then fails with 23P01.
#
# This is the scenario a "SELECT then INSERT" check cannot survive — both
# sessions would read "free" before either wrote.
set -u

PSQL="${PSQL:-psql}"
DB="${DB:-booking_test}"
CONN=(-h 127.0.0.1 -p 5433 -U postgres -d "$DB" -q -t -A)

SLOT_A="2030-04-01 12:00+03"
SLOT_B="2030-04-01 13:00+03"

reset_slot() {
  "$PSQL" "${CONN[@]}" -c "delete from time_blocks where lower(slot) in ('$SLOT_A'::timestamptz, '$SLOT_B'::timestamptz);" >/dev/null
}

now_ms() { date +%s%3N; }

booking_insert() {  # $1 = slot start, $2 = customer
  cat <<SQL
insert into time_blocks (resource_id, kind, slot, customer_name, customer_email, party_size)
values (_rid('room-a'), 'booking',
        tstzrange('$1'::timestamptz, '$1'::timestamptz + interval '1 hour', '[)'),
        '$2', '$2@example.com', 2);
SQL
}

echo "=============================================="
echo "SCENARIO 1: both commit -> exactly one wins"
echo "=============================================="
reset_slot

# Winner holds the row uncommitted for 3s, so the loser is forced to wait.
(
  "$PSQL" "${CONN[@]}" -v ON_ERROR_STOP=1 <<SQL 2>&1 | sed 's/^/  [A] /'
begin;
$(booking_insert "$SLOT_A" 'alice')
select pg_sleep(3);
commit;
select 'A committed';
SQL
) &
PID_A=$!

sleep 1  # B arrives while A's transaction is still open

(
  start=$(now_ms)
  out=$("$PSQL" "${CONN[@]}" <<SQL 2>&1
begin;
$(booking_insert "$SLOT_A" 'bob')
commit;
SQL
)
  end=$(now_ms)
  waited=$(( end - start ))
  echo "  [B] waited ${waited}ms"
  echo "$out" | sed 's/^/  [B] /'
  if [ "$waited" -lt 1000 ]; then
    echo "  [B] !! returned immediately — it did NOT block on A's uncommitted row"
  else
    echo "  [B] blocked until A committed, as expected"
  fi
) &
PID_B=$!

wait $PID_A $PID_B

echo ""
echo "rows now holding $SLOT_A (must be exactly 1):"
"$PSQL" "${CONN[@]}" -c \
  "select count(*)||' row(s), customer='||coalesce(string_agg(customer_name,','),'-')
     from time_blocks
    where status='confirmed' and lower(slot)='$SLOT_A'::timestamptz;" | sed 's/^/  /'

echo ""
echo "=============================================="
echo "SCENARIO 2: winner rolls back -> loser gets the slot"
echo "=============================================="
reset_slot

(
  "$PSQL" "${CONN[@]}" <<SQL >/dev/null 2>&1
begin;
$(booking_insert "$SLOT_B" 'carol')
select pg_sleep(3);
rollback;
SQL
  echo "  [A] rolled back"
) &
PID_A=$!

sleep 1

(
  out=$("$PSQL" "${CONN[@]}" <<SQL 2>&1
begin;
$(booking_insert "$SLOT_B" 'dave')
commit;
SQL
)
  echo "$out" | sed 's/^/  [B] /'
) &
PID_B=$!

wait $PID_A $PID_B

echo ""
echo "rows now holding $SLOT_B (must be exactly 1, customer=dave):"
"$PSQL" "${CONN[@]}" -c \
  "select count(*)||' row(s), customer='||coalesce(string_agg(customer_name,','),'-')
     from time_blocks
    where status='confirmed' and lower(slot)='$SLOT_B'::timestamptz;" | sed 's/^/  /'

reset_slot
