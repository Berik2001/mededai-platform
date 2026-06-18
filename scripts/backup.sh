#!/usr/bin/env bash
#
# Standalone PostgreSQL backup using pg_dump (custom/compressed format).
#
# Use this for system cron or a container sidecar instead of the in-app
# scheduler. Restore with:  pg_restore --clean --dbname="$DATABASE_URL" <file>
#
# Required env:
#   DATABASE_URL           postgres connection string
# Optional env:
#   BACKUP_DIR             output directory (default: ./backups)
#   BACKUP_RETENTION_DAYS  prune dumps older than N days (default: 7)
#
# Example crontab (daily at 03:00):
#   0 3 * * * DATABASE_URL="postgresql://med:medpass@localhost:5432/med_platform" \
#     /path/to/scripts/backup.sh >> /var/log/med-backup.log 2>&1

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y-%m-%dT%H-%M-%S)"
FILE="${BACKUP_DIR}/backup-${STAMP}.dump"

# Prisma connection strings carry a `?schema=` param that pg_dump (libpq) rejects.
# Move it to --schema and strip it from the URI.
SCHEMA="$(printf '%s' "$DATABASE_URL" | sed -n 's/.*[?&]schema=\([^&]*\).*/\1/p')"
CLEAN_URL="$(printf '%s' "$DATABASE_URL" | sed -E 's/([?&])schema=[^&]*//; s/\?&/?/; s/[?&]$//')"
SCHEMA_ARG=()
[ -n "$SCHEMA" ] && SCHEMA_ARG=(--schema="$SCHEMA")

echo "[backup] dumping database → ${FILE}"
pg_dump --dbname="$CLEAN_URL" "${SCHEMA_ARG[@]}" --format=custom --no-owner --file="$FILE"
echo "[backup] done ($(du -h "$FILE" | cut -f1))"

echo "[backup] pruning dumps older than ${BACKUP_RETENTION_DAYS} day(s)"
find "$BACKUP_DIR" -maxdepth 1 -name 'backup-*.dump' -mtime "+${BACKUP_RETENTION_DAYS}" -print -delete

echo "[backup] complete"
