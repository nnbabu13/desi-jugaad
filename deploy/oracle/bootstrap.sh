#!/usr/bin/env bash
# ============================================================================
# One-time Oracle Linux 9.x setup for the Desi Jugaad API.
# Idempotent: safe to re-run. NEVER touches database contents.
#
# Prerequisites (see deploy/README.md):
#   - code extracted to /opt/desi-jugaad (deploy/push-to-vm.ps1 does this)
#   - /opt/desi-jugaad/.env created from .env.production.example (chmod 600)
#   - PostgreSQL already running with the desi_jugaad database (this script
#     only VERIFIES it - it never creates, drops or resets anything)
#
# Run:  bash /opt/desi-jugaad/deploy/oracle/bootstrap.sh
# ============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/desi-jugaad}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== 1/8 base packages =="
sudo dnf install -y dnf-plugins-core curl tar gzip postgresql >/dev/null

echo "== 2/8 Node.js 26+ =="
if command -v node >/dev/null 2>&1 && [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -ge 26 ]; then
  echo "   already installed: $(node -v)"
else
  curl -fsSL https://rpm.nodesource.com/setup_26.x | sudo bash - >/dev/null
  sudo dnf install -y nodejs >/dev/null
  echo "   installed: $(node -v)"
fi

echo "== 3/8 pnpm (exact version from package.json packageManager) =="
PNPM_VERSION="$(sed -n 's/.*"packageManager": "pnpm@\([^"]*\)".*/\1/p' "$APP_DIR/package.json")"
[ -n "$PNPM_VERSION" ] || PNPM_VERSION="11.9.0"
sudo npm install --silent -g "pnpm@$PNPM_VERSION"
echo "   $(pnpm -v)"

echo "== 4/8 directories =="
mkdir -p "$APP_DIR"
# /opt is root-owned; the opc user owns the backup dir (update-app.sh and the
# daily pg_dump cron both write here as opc).
sudo mkdir -p /opt/backups
sudo chown opc:opc /opt/backups 2>/dev/null || true

echo "== 5/8 Caddy (official EL9 repo) =="
sudo dnf install -y 'dnf-command(copr)' >/dev/null
sudo dnf copr enable -y @caddy/caddy >/dev/null 2>&1 || true
sudo dnf install -y caddy >/dev/null
if [ -f "$SCRIPT_DIR/Caddyfile" ]; then
  sudo mkdir -p /etc/caddy
  if [ -f /etc/caddy/Caddyfile ] && ! sudo cmp -s "$SCRIPT_DIR/Caddyfile" /etc/caddy/Caddyfile; then
    sudo cp -n /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%Y%m%d%H%M%S) || true
  fi
  sudo cp "$SCRIPT_DIR/Caddyfile" /etc/caddy/Caddyfile
fi
sudo systemctl enable --now caddy
echo "   $(caddy version 2>/dev/null || echo caddy installed)"

echo "== 6/8 systemd unit =="
sudo cp "$SCRIPT_DIR/desi-jugaad-api.service" /etc/systemd/system/desi-jugaad-api.service
sudo systemctl daemon-reload
sudo systemctl enable desi-jugaad-api.service
if [ -f "$APP_DIR/.env" ]; then
  sudo systemctl restart desi-jugaad-api.service
  echo "   service started"
else
  echo "   WARNING: $APP_DIR/.env missing - service enabled but NOT started."
  echo "           Create it from .env.production.example, then: sudo systemctl start desi-jugaad-api"
fi

echo "== 7/8 host firewall =="
if systemctl is-active --quiet firewalld 2>/dev/null; then
  # Oracle Linux runs firewalld by default. Enabling ufw *alongside* it would
  # make two managers fight over nftables and can lock out SSH on a remote
  # host, so we add only the two web services to the active firewalld zone.
  # Default zone already allows ssh and denies everything else (4000/5432
  # stay closed).
  sudo firewall-cmd --permanent --add-service=http >/dev/null
  sudo firewall-cmd --permanent --add-service=https >/dev/null
  sudo firewall-cmd --reload >/dev/null
  echo "   firewalld: $(sudo firewall-cmd --list-all | grep -E 'services:' | sed 's/^ *//')"
elif command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 22/tcp comment 'SSH' >/dev/null
  sudo ufw allow 80/tcp comment 'Caddy HTTP-01 + redirect' >/dev/null
  sudo ufw allow 443/tcp comment 'Caddy HTTPS' >/dev/null
  # NO rule for 4000 or 5432: default incoming deny keeps them private.
  sudo ufw --force enable >/dev/null
  sudo ufw status verbose | sed 's/^/   /'
else
  echo "   installing ufw from AppStream..."
  sudo dnf install -y ufw >/dev/null 2>&1 || {
    sudo dnf install -y epel-release >/dev/null 2>&1 || true
    sudo dnf install -y ufw >/dev/null 2>&1
  }
  if command -v ufw >/dev/null 2>&1; then
    sudo ufw allow 22/tcp >/dev/null
    sudo ufw allow 80/tcp >/dev/null
    sudo ufw allow 443/tcp >/dev/null
    sudo ufw --force enable >/dev/null
    sudo ufw status verbose | sed 's/^/   /'
  else
    echo "   ERROR: neither firewalld nor ufw is usable - see deploy/README.md"
    exit 1
  fi
fi

echo "== 8/8 verification =="
echo "   node:     $(node -v)"
echo "   pnpm:     $(pnpm -v)"
echo "   postgres: $(systemctl is-active postgresql.service 2>/dev/null || echo 'unit name differs - run: systemctl list-units | grep -i postgres')"
echo "   caddy:    $(systemctl is-active caddy)"
echo "   api:      $(systemctl is-active desi-jugaad-api)"
echo "   ufw:      $(sudo ufw status | head -1)"
echo
echo "IMPORTANT: inbound 80/443 must ALSO be opened in the Oracle Cloud"
echo "security list (console step, see deploy/README.md). Then verify:"
echo "  curl -sS https://132-226-212-175.sslip.io/api/v1/health"
