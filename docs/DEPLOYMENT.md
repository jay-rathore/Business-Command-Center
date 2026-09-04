# Deploying to a VPS

A step-by-step runbook for deploying this app to a bare VPS with Docker Compose, using each
Dockerfile's `prod` target (see `docker/docker-compose.prod.yml`). Written from a real deploy
onto a shared Hostinger KVM VPS that already runs unrelated services — the pre-flight phase below
exists specifically because of that, and is worth doing even on a VPS you believe is empty.

Every command below assumes you're SSH'd in as `root` (or a sudo user — prefix with `sudo`).

## Architecture recap

Three containers: `postgres`, `backend` (NestJS, port 4000), `frontend` (Next.js, port 3005
internally). No domain is required to deploy — the app is reachable over plain HTTP on the VPS's
IP once ports are published. Postgres never publishes a host port; it's only reachable from
`backend` over the Compose-internal network, so it can't collide with — or be reached alongside —
any other database on the box.

## Phase 0 — Audit what's already on the box

**Do this before installing or touching anything.** A VPS is rarely as empty as it looks, and
finding a conflict now is a lot cheaper than after `docker compose up` fails halfway through.

```bash
ss -tlnp                                    # what's listening on which ports, and by what
docker ps -a 2>&1                           # is Docker even installed / running?
systemctl status postgresql --no-pager 2>&1 # native Postgres?
systemctl status mysql --no-pager 2>&1      # native MySQL?
systemctl status mariadb --no-pager 2>&1    # native MariaDB?
cat /etc/os-release                         # distro + version
ufw status verbose                          # is the firewall active, and what's already allowed?
free -h                                     # RAM headroom — Next.js/Nest builds want ~2-4GB free
df -h /                                     # disk headroom
nproc                                       # CPU count
```

**What to look for:**

- **Anything already bound to port 80 or 4000** (our default frontend/backend host ports) in the
  `ss -tlnp` output. A bind conflict doesn't corrupt the existing service — Docker just fails to
  start the container that wants the taken port — but you'll want to pick different host ports
  up front rather than debug a failed `up` later. See "Picking ports" below.
- **A database already running for another app.** As long as our `postgres` service has no
  `ports:` entry (it doesn't, by default, in `docker-compose.prod.yml`), there is no way for it
  to collide with an existing MySQL/Postgres/MariaDB — different engine or not, it's simply never
  exposed to the host. You do not need to change anything for this case; it's safe by
  construction. Just don't add a `ports:` mapping to the `postgres` service.
- **`ufw status` already has rules.** If the firewall is active and other apps rely on specific
  allowed ports, only ever *add* the two ports this app needs — never remove or modify an
  existing rule. If a rule you'd expect (like 80/443) is conspicuously absent even though
  something's listening there, that's information about the *other* app, not something to fix as
  part of this deploy.
- **`docker ps -a` errors with "Cannot connect to the Docker daemon"** — Docker may be installed
  but stopped (`systemctl status docker` will show `inactive`), or not installed at all. Both are
  handled in Phase 3.

### Picking ports

Default plan: frontend on host port **80**, backend on host port **4000**. If Phase 0 shows
either is already taken (e.g. Apache/nginx on 80 for another site), pick free alternates instead
— 8080 and 4000 in this deployment's case, since 80 was taken by Apache. Whatever you choose,
those exact values thread through several places below: the compose file's `ports:`, `.env`'s
`CORS_ORIGIN` and `NEXT_PUBLIC_API_URL`, and the `ufw allow` rules. They're called out at each
step.

## Phase 1 — Connect

```bash
ssh root@<VPS_IP>
```

## Phase 2 — Base setup

```bash
apt update && apt upgrade -y
apt install -y git
```

If `ufw` isn't active yet on a genuinely fresh VPS, set a default-deny baseline before opening
anything:
```bash
ufw allow OpenSSH
ufw enable
```
(Skip this if `ufw status` in Phase 0 already showed `active` — don't re-run `enable`, and don't
touch the existing rule set beyond adding this app's two ports below.)

Open this app's ports — substitute your actual choices from "Picking ports" above:
```bash
ufw allow 80/tcp     # or 8080, etc. — frontend
ufw allow 4000/tcp   # backend
ufw status verbose   # confirm both show ALLOW, and nothing else changed
```

## Phase 3 — Docker

```bash
docker --version 2>&1
```

- **Command not found** → install it: `curl -fsSL https://get.docker.com | sh`
- **Version prints, but `docker ps -a` errors "Cannot connect to the Docker daemon"** → it's
  installed but not running:
  ```bash
  systemctl enable --now docker
  docker ps -a   # should now print an empty table, not an error
  ```

## Phase 4 — Clone the repo

```bash
git clone https://github.com/jay-rathore/Business-Command-Center.git hpl-command-center
cd hpl-command-center
git checkout feature/multi-tenant-saas-foundation   # the active branch — main lags behind
```

## Phase 5 — Configure `.env`

```bash
cp .env.example .env
nano .env
```

| Variable | Set to | Why |
|---|---|---|
| `POSTGRES_PASSWORD` | a strong random password | not the `change_me_locally` dev default |
| `DATABASE_URL` | `postgresql://hpl_admin:<same password>@postgres:5432/hpl_command_center` | host must be the Compose service name `postgres` and container-internal port `5432` — **not** `localhost:5433`, that's only the dev-compose host-mapped port |
| `JWT_ACCESS_SECRET` | output of `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | run it fresh each time — don't reuse a value from another deploy |
| `JWT_REFRESH_SECRET` | same command again, a different value | |
| `INTEGRATION_ENCRYPTION_KEY` | same command again, a third value | encrypts per-tenant Meta/Google/GA4/etc. credentials — **write this one down**: if you later migrate a database dump that has encrypted `IntegrationConnection` rows, they only decrypt with the exact key that encrypted them |
| `CORS_ORIGIN` | `http://<VPS_IP>:<frontend host port>` (omit the port if it's 80) | must exactly match the origin the browser sends — a mismatch here is the #1 cause of "login works, then immediately bounces back" |
| `COOKIE_SECURE` | `false` | must stay false until the app is served over real HTTPS — a `Secure` cookie is silently dropped by the browser over plain HTTP, breaking auth with no visible error. Flip to `true` when a domain + TLS is added |
| `NEXT_PUBLIC_API_URL` | `http://<VPS_IP>:<backend host port>` | browser-facing — this is baked into the frontend's JS bundle at *build* time (see the note in `docker-compose.prod.yml`), so it must be correct before the build in Phase 6, and changing it later requires an image rebuild, not just a restart |

Leave `OPENAI_API_KEY`, `WHATSAPP_*`, `EMAIL_SMTP_*` blank for a first deploy — those only gate
quotation AI-parsing / WhatsApp / email send, nothing else depends on them.

`docker/docker-compose.prod.yml` reads the frontend's host-side port from its own `ports:` line,
not from `.env` — if you picked a non-default frontend port in Phase 0, edit that file too:
```yaml
  frontend:
    ports:
      - "8080:3005"   # host port : container port — change the left side only
```

## Phase 6 — Build, migrate, seed, start

Order matters: the database schema has to exist before the backend can serve traffic without
crash-looping (some services query the DB during app bootstrap).

```bash
# 1. Build all three images
docker compose -f docker/docker-compose.prod.yml --env-file .env build

# 2. Start Postgres only, wait for "healthy"
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d postgres
docker compose -f docker/docker-compose.prod.yml --env-file .env ps

# 3. Run migrations (one-off container; exits when done)
docker compose -f docker/docker-compose.prod.yml --env-file .env run --rm backend npx prisma migrate deploy

# 4. Seed demo data — gives you working login credentials to verify the deploy end-to-end.
#    This is fabricated demo data (~500 orders, 30 dealers, a handful of architects/builders,
#    etc.) for a clean-start deploy; skip this step if/when restoring a real DB dump instead.
docker compose -f docker/docker-compose.prod.yml --env-file .env run --rm backend npm run db:seed

# 5. Start everything
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d
```

## Phase 7 — Verify

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env ps      # all "Up"
docker compose -f docker/docker-compose.prod.yml --env-file .env logs backend --tail 50
```

From a browser: `http://<VPS_IP>:<frontend port>` → log in with `owner@hplmaker.demo` /
`Passw0rd!123` (full seeded-user list in the main README).

**Login succeeds but immediately bounces back to the login page** → `CORS_ORIGIN` and/or
`NEXT_PUBLIC_API_URL` don't match what you're actually visiting. Fix `.env`, then:
```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build frontend
```
(`--build` is required if `NEXT_PUBLIC_API_URL` changed — it's baked in, a plain restart won't
pick up the new value.)

**Backend container keeps restarting** → check `logs backend`; almost always means Phase 6 step 3
(migrations) didn't run or didn't finish before step 5.

## Deploy-blocking bugs already fixed in this codebase

Two real gaps were found and fixed while building this runbook — worth knowing about if either
resurfaces after a refactor:

1. **`NEXT_PUBLIC_API_URL` must be a Docker build ARG, not a runtime env var.** Next.js inlines
   `NEXT_PUBLIC_*` vars into the browser bundle at `next build` time. `apps/frontend/Dockerfile`'s
   `build` stage declares `ARG NEXT_PUBLIC_API_URL`; `docker-compose.prod.yml` passes it via
   `build.args`. If a future edit moves it back to a plain `environment:` entry, the browser
   bundle will silently fall back to `http://localhost:4000` in every built image.
2. **Auth cookies' `Secure` flag is `COOKIE_SECURE`, not `NODE_ENV === 'production'`.** The `prod`
   Docker image always sets `NODE_ENV=production` regardless of whether the app is actually
   served over HTTPS — tying the cookie flag to it would make login silently impossible on any
   HTTP-only deploy (`apps/backend/src/auth/auth.controller.ts`).

## Deliberately deferred (not part of a first deploy)

- **Domain + HTTPS** — add a reverse proxy (Caddy is the natural fit — automatic Let's Encrypt
  certs with a few lines of config) in front of the frontend/backend ports, then flip
  `COOKIE_SECURE=true` and update `CORS_ORIGIN`/`NEXT_PUBLIC_API_URL` to `https://yourdomain`,
  followed by a frontend rebuild (build-arg change, see Phase 7's login-bounce fix above).
- **Migrating the real database** (as opposed to the seeded demo data) — separate walkthrough:
  `pg_dump` the source DB, restore into the VPS's `postgres` container, and carry over the exact
  `INTEGRATION_ENCRYPTION_KEY` from Phase 5 so existing encrypted `IntegrationConnection` rows
  (Meta/Google Ads/GA4/Search Console credentials) still decrypt.
- **systemd** — not needed. `restart: unless-stopped` on every service in the compose file already
  survives a VPS reboot, as long as the Docker daemon itself is enabled (`systemctl enable
  docker`, done once in Phase 3).
