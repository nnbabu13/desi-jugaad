#!/usr/bin/env bash
# ============================================================================
# Update the deployed Desi Jugaad API from a staged tarball.
# Invoked by deploy/push-to-vm.ps1 after copying the archive to the VM.
#
# Safety rules:
#   - never touches database CONTENTS
#   - takes a pg_dump BACKUP before applying migrations
#   - only ever applies pending migrations (prisma migrate deploy - no reset)
#   - waits for the health endpoint (which checks the database) afterwards
#
# Usage: update-app.sh [tarball]   (default /tmp/desi-jugaad-app.tar.gz)
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/desi-jugaad}"
TARBALL="${1:-/tmp/desi-jugaad-app.tar.gz}"

[ -f "$TARBALL" ] || { echo "ERROR: tarball not found: $TARBALL" >&2; exit 1; }
[ -f "$APP_DIR/.env" ] || { echo "ERROR: $APP_DIR/.env missing (copy .env.production.example)" >&2; exit 1; }

echo "== 1/6 extract code (untracked .env is preserved) =="
tar -xzf "$TARBALL" -C "$APP_DIR" --overwrite
cd "$APP_DIR"

echo "== 2/6 install dependencies =="
pnpm install --frozen-lockfile

echo "== 3/6 prisma generate =="
pnpm --filter @desi-jugaad/api prisma:generate

echo "== 4/6 build =="
pnpm --filter @desi-jugaad/api build

echo "== 5/6 database backup BEFORE migrations =="
set -a
# shellcheck disable=SC1091
. "$APP_DIR/.env"
set +a
mkdir -p /opt/backups
BK="/opt/backups/desi-jugaad-$(date +%Y%m%d-%H%M%S).sql.gz"
pg_dump --no-owner "$DATABASE_URL" | gzip > "$BK"
echo "   backup -> $BK ($(du -h "$BK" | cut -f1))"
# keep the newest 14 backups only
ls -1t /opt/backups/desi-jugaad-*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm -f

echo "== 6/6 apply pending migrations and restart =="
pnpm --filter @desi-jugaad/api prisma:deploy
if systemctl list-unit-files --no-legend 2>/dev/null | grep -q '^desi-jugaad-api'; then
  sudo systemctl restart desi-jugaad-api
  for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:4000/api/v1/health >/dev/null 2>&1; then
      echo "health OK: $(curl -s http://127.0.0.1:4000/api/v1/health)"
      exit 0
    fi
    sleep 1
  done
  echo "ERROR: API did not become healthy in 30s" >&2
  journalctl -u desi-jugaad-api -n 60 --no-pager || true
  exit 1
else
  echo "NOTE: systemd unit not installed yet - code is in place."
  echo "      Run deploy/oracle/bootstrap.sh once to install Caddy/systemd/UFW."
fi
