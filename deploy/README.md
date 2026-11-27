# Desi Jugaad — Production Deployment Guide

Architecture:

```
Browser ──HTTPS──> https://nnbabu13.github.io/desi-jugaad/     (GitHub Pages, static Expo web export)
   │                        │ EXPO_PUBLIC_API_URL (baked at build time)
   └────────────HTTPS──────> https://132-226-212-175.sslip.io   (Caddy on Oracle VM, Let's Encrypt)
                                 └── reverse_proxy ──> 127.0.0.1:4000  (NestJS, systemd)
                                                        └──> 127.0.0.1:5432  (PostgreSQL, LOCAL ONLY)
```

Everything below is grouped by **where the command runs**.
No step uses a paid service or a purchased domain.

---

## Status

| Item | State |
|---|---|
| Pages workflow + static export (base path `/desi-jugaad`) | ✅ done, first deploy verified |
| Repo variable `EXPO_PUBLIC_API_URL` | ✅ set to `https://132-226-212-175.sslip.io` |
| Pages enabled (source: GitHub Actions, branch main) | ✅ |
| Cross-site cookie (`SameSite=None; Secure`) + CORS code | ✅ in repo (this commit) |
| Oracle VM: Node/pnpm/Caddy/systemd/UFW + app | ⬜ steps A–D below |
| OCI ingress for TCP 80/443 | ⬜ **your console click** (step B) |

---

## A. GitHub repository settings — GitHub website

1. **Variable** (done): Settings → Secrets and variables → Actions → *Variables* → `EXPO_PUBLIC_API_URL = https://132-226-212-175.sslip.io`
2. **Make the repository public** (you chose this): Settings → General → Danger Zone → *Change visibility* → Public. (Pages on private repos needs a paid plan.)
3. First deployment may wait for approval under Actions → *Deploy to GitHub Pages* → environment `github-pages` → *Review required approvals* (only if your org/repo enables required reviewers).

Re-run any time: Actions → *Deploy to GitHub Pages* → *Run workflow*.

---

## B. Oracle Cloud console — your click (once)

The VM's host firewall (UFW, step C) is only half the story: **Oracle's security list currently blocks 80/443 (verified)**.

1. Oracle Cloud → Compute → Instances → your VM → **Networking → Edit** (or VCN → Security lists):
   Add **stateless ingress** rules, source `0.0.0.0/0`:
   | Protocol | Dest port | Purpose |
   |---|---|---|
   | TCP | 80 | Let's Encrypt HTTP-01 + HTTP→HTTPS redirect |
   | TCP | 443 | API HTTPS |
2. Leave **5432 and 4000 closed** (never expose them).
3. Keep **22 restricted** if practical: instead of `0.0.0.0/0`, use your IP: `x.x.x.x/32`.
4. **Reserved public IP**: assign a *Reserved Public IP* in the console to this VM. sslip.io derives the hostname from the IP — with a reserved IP the hostname `132-226-212-175.sslip.io` survives stop/start. If the IP ever changes: update `deploy/oracle/Caddyfile` **and** the `EXPO_PUBLIC_API_URL` variable, then redeploy both sides.

Verify from your Windows machine:

```powershell
Test-NetConnection 132.226.212.175 -Port 80   # TcpTestSucceeded : True
Test-NetConnection 132.226.212.175 -Port 443  # TcpTestSucceeded : True
```

---

## C. Oracle VM — one-time setup (SSH)

> The VM runs **Oracle Linux 9.8** (not Ubuntu); scripts use `dnf`.
> Postgres is already installed and running with the `desi_jugaad` database —
> these steps never create, drop or reset a database.

```powershell
# --- from Windows: prepare the PRODUCTION env file (never commit it) ---
Copy-Item .env.production.example $env:TEMP\desi-jugaad-prod.env
notepad $env:TEMP\desi-jugaad-prod.env
#   fill: DATABASE_URL (reuse your existing user/password, host 127.0.0.1:5432),
#         JWT_SECRET (node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")

$KEY = "$env:USERPROFILE\.ssh\ssh-key-2026-09-06.key"
scp -i $KEY $env:TEMP\desi-jugaad-prod.env opc@132.226.212.175:/opt/desi-jugaad/.env
ssh -i $KEY opc@132.226.212.175 "mkdir -p /opt/desi-jugaad && sudo chown opc:opc /opt/desi-jugaad/.env && chmod 600 /opt/desi-jugaad/.env"
Remove-Item $env:TEMP\desi-jugaad-prod.env

# --- from Windows: ship the code (archive HEAD -> scp -> install/build/migrate) ---
.\deploy\push-to-vm.ps1

# --- from Windows/SSH: install Node 26, pnpm, Caddy, systemd, UFW (once) ---
ssh -i $KEY opc@132.226.212.175 "cd /opt/desi-jugaad && bash deploy/oracle/bootstrap.sh"
```

`push-to-vm.ps1` is also **the update command for every future release** (it
takes a `pg_dump` backup before applying migrations and restarts the service).

---

## D. Verify (run in order)

```powershell
# 1. API over public HTTPS (through Caddy; certificate auto-issued on first hit)
curl.exe -sS https://132-226-212-175.sslip.io/api/v1/health
#    -> {"status":"ok",...,"database":{"status":"up",...}}

# 2. API NOT reachable directly on its port (must fail)
curl.exe -sS --max-time 5 http://132.226.212.175:4000/api/v1/health   # must fail/timeout

# 3. PostgreSQL NOT public (must fail)
Test-NetConnection 132.226.212.175 -Port 5432   # TcpTestSucceeded : False

# 4. Frontend
Invoke-WebRequest https://nnbabu13.github.io/desi-jugaad/ -UseBasicParsing | % StatusCode   # 200
Invoke-WebRequest https://nnbabu13.github.io/desi-jugaad/rooms -UseBasicParsing | % StatusCode # 200
#    (deep link /chat/<id> returns 404 + fallback HTML by design - the app recovers client-side)
```

Browser checklist (the app itself): load Pages site → rooms listed (API now
reachable) → register → sign in → reload keeps the session (cross-site
refresh cookie) → sign out (cookie cleared) → CORS preflight passes in devtools
Network → direct refresh of `/desi-jugaad/rooms` works.

**Cookie reality check (honest expectation):** `SameSite=None; Secure` is
*required* for cross-site refresh and works in Chrome/Edge/Firefox normal
settings. Safari and Chrome configurations that block third-party cookies may
still refuse to persist the refresh cookie — users would simply sign in again
after a reload. Refresh tokens are deliberately **never** stored client-side
in JS; changing that would trade XSS resistance for convenience and requires
explicit approval.

---

## E. Operations (single VM — no high availability)

```bash
# logs (systemd journal)
ssh -i $KEY opc@132.226.212.175 "journalctl -u desi-jugaad-api -n 200 --no-pager"
ssh -i $KEY opc@132.226.212.175 "journalctl -u caddy -n 100 --no-pager"

# service status / restart
ssh -i $KEY opc@132.226.212.175 "systemctl status desi-jugaad-api --no-pager"
ssh -i $KEY opc@132.226.212.175 "sudo systemctl restart desi-jugaad-api"

# health (also exposed publicly)
curl -sS https://132-226-212-175.sslip.io/api/v1/health

# disk space (logs/backups grow)
ssh -i $KEY opc@132.226.212.175 "df -h / && sudo journalctl --vacuum-size=200M"

# backups (taken automatically before every deploy; add a daily one too)
ssh -i $KEY opc@132.226.212.175 "crontab -l"   # add if missing:
# 0 3 * * * . /opt/desi-jugaad/.env; pg_dump --no-owner \"$DATABASE_URL\" | gzip > /opt/backups/desi-jugaad-daily-$(date +\%F).sql.gz; ls -1t /opt/backups/*.sql.gz | tail -n +15 | xargs -r rm -f

# reboot verification
ssh -i $KEY opc@132.226.212.175 "systemctl is-enabled desi-jugaad-api caddy; curl -sf localhost:4000/api/v1/health"
```

**Single-server risk, stated plainly:** one VM is a single point of failure —
a reboot, OCI outage, or full disk takes the API down until fixed (the Pages
site stays up but shows empty states). `systemctl` restart policies cover
process crashes, not machine loss. True HA would need a second instance + a
managed database; out of scope for this no-cost deployment.

---

## F. Security notes

- Repository history was audited before public visibility: **no `.env`, keys
  or credentials were ever committed** (only `.env.example` with `CHANGE_ME`
  placeholders). Seeded demo accounts have no passwords (not login targets).
- Production `.env` lives only at `/opt/desi-jugaad/.env` (mode 600, owner
  opc) and on your Windows machine — never in git, never in `EXPO_PUBLIC_*`.
- Not exposed publicly: port 4000 (bind 127.0.0.1 + UFW deny), port 5432
  (local bind + UFW deny + OCI security list).
- Existing protections untouched: JWT auth, throttling (300/min, auth
  5–10/min), ValidationPipe whitelist, httpOnly refresh cookie, CORS origin
  allow-list.
- If a secret ever *does* land in git history: rotate it first
  (`JWT_SECRET` regenerate + `DATABASE_URL` password via `ALTER USER`), then
  purge history (`git filter-repo`) and force-push — but nothing needs this
  today.
