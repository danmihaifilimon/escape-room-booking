#!/usr/bin/env bash
# Applies the migration to a throwaway database and runs every suite.
#
#   PSQL=/path/to/psql PGPORT=5433 bash supabase/tests/run.sh
#
# Requires a plain Postgres with btree_gist and citext available. The Supabase
# pieces the migration leans on (auth.users, auth.uid(), the anon/authenticated
# roles) are stubbed by 00_local_stub.sql.
set -euo pipefail

PSQL="${PSQL:-psql}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-postgres}"
DB="${DB:-booking_test}"

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"

admin=(-h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -q)
db=("${admin[@]}" -d "$DB" -v ON_ERROR_STOP=1)

echo "==> recreating $DB"
"$PSQL" "${admin[@]}" -c "drop database if exists $DB;" -c "create database $DB;" 2>&1 | grep -v NOTICE || true

echo "==> stub + migration"
"$PSQL" "${db[@]}" -f "$HERE/00_local_stub.sql"  > /dev/null
"$PSQL" "${db[@]}" -f "$ROOT/migrations/0001_init.sql" > /dev/null

fail=0
for suite in 01_constraints 03_availability 04_rpc_rls; do
  echo "==> $suite"
  if ! "$PSQL" "${db[@]}" -f "$HERE/$suite.sql" 2>&1 | grep -E "^\s+---|ERROR"; then
    echo "   (no output — suite did not reach its final marker)"; fail=1
  fi
done

echo "==> 02_race (two concurrent transactions)"
PSQL="$PSQL" DB="$DB" bash "$HERE/02_race.sh" | grep -E "waited|row\(s\)|blocked|!!"

if [ "$fail" -ne 0 ]; then echo "SUITE FAILED"; exit 1; fi
echo "all suites passed"
