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
- **`free -h` shows `Swap: 0B`.** Treat this as a blocker, not a nice-to-have, on any box under
  ~16GB RAM — see "Swap space" in Phase 2 for why, and set it up *before* Phase 6's build, not
  after.

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

### Swap space — do this if Phase 0 showed `Swap: 0B`

**Not optional on a shared box.** During a real deploy on an 8GB/2-vCPU VPS with zero swap, the
Docker build's memory usage combined with an unrelated app already running on the box pushed the
kernel into OOM (out-of-memory) killing — and it didn't just kill our build, it killed that other
app's **MySQL process**, taking its database down until systemd auto-restarted it. With swap in
place, the same memory pressure just makes things temporarily slower instead of triggering the
kernel to start forcibly killing processes (its own, or worse, an unrelated one). Cheap insurance,
skip it at your own (and everyone else sharing the box's) risk:

```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab   # survives a reboot
free -h   # confirm Swap now shows 4.0Gi
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
```

**Recommended: fill it in with a script**, rather than hand-editing in `nano` while switching to
another window to generate secrets. Fill in just `VPS_IP` and `FRONTEND_PORT` at the top, then
paste the whole block as one unit:

```bash
VPS_IP="203.0.113.10"     # <-- your actual VPS IP
FRONTEND_PORT="80"        # <-- 80, or whatever alternate you picked in "Picking ports" above

PG_PASSWORD="$(openssl rand -hex 16)"
JWT_ACCESS_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
JWT_REFRESH_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
INTEGRATION_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"

sed -i "s|POSTGRES_PASSWORD=change_me_locally|POSTGRES_PASSWORD=${PG_PASSWORD}|" .env
sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://hpl_admin:${PG_PASSWORD}@postgres:5432/hpl_command_center|" .env
sed -i "s|JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}|" .env
sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|" .env
sed -i "s|INTEGRATION_ENCRYPTION_KEY=.*|INTEGRATION_ENCRYPTION_KEY=${INTEGRATION_ENCRYPTION_KEY}|" .env
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=http://${VPS_IP}:${FRONTEND_PORT}|" .env
sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://${VPS_IP}:4000|" .env

echo "=== .env now contains: ==="
cat .env
echo "=== Save these somewhere safe, especially the encryption key: ==="
echo "POSTGRES_PASSWORD=${PG_PASSWORD}"
echo "INTEGRATION_ENCRYPTION_KEY=${INTEGRATION_ENCRYPTION_KEY}"
```

`node` runs fine here even though it's not installed globally on the VPS — Docker isn't involved
yet at this point, this just needs *some* Node available; if the VPS genuinely has none, swap
those three lines for `openssl rand -base64 32` instead, same effect.

If `CORS_ORIGIN` ends up as `http://<ip>:80`, edit that one line to drop the `:80` — the browser
sends `Origin: http://<ip>` with no port for the default HTTP port, and the two have to match
exactly or every request gets rejected by CORS.

**Alternative: hand-edit instead.** If you'd rather see and adjust every line yourself:
```bash
nano .env
```
Arrow keys to move (no mouse), type to edit, `Ctrl+O` then `Enter` to save, `Ctrl+X` to exit. The
table below is what to change either way.

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

Two ways to get the images onto the VPS. **6A is recommended** — building directly on a small
shared VPS is exactly what caused the OOM incident in Phase 2's "Swap space" section (it killed an
unrelated app's database on the same box). 6B is kept for a VPS with real headroom (4+ vCPUs,
16GB+ RAM) or as a fallback if 6A's registry isn't reachable for some reason.

Order matters either way: the database schema has to exist before the backend can serve traffic
without crash-looping (some services query the DB during app bootstrap).

### Phase 6A — Build elsewhere, deploy prebuilt images (recommended)

Build on a separate machine — your own laptop/desktop, anywhere with Docker and more headroom than
a small shared VPS — and push to GitHub's container registry (`ghcr.io`, free for a public repo).
The VPS then only ever `pull`s a finished image: no compilation, no `npm install`, minimal
memory/CPU, and it structurally can't repeat the OOM incident no matter what else is running on
the box — `docker/docker-compose.deploy.yml` has no `build:` section at all.

**One-time, on the build machine:**
1. Create a GitHub token: https://github.com/settings/tokens → Generate new token (classic) →
   scope `write:packages` → Generate, copy it (shown once).
2. Log in:
   ```bash
   docker login ghcr.io -u <your-github-username>
   ```
   Paste the token as the password when prompted.

**Every time you deploy new code, on the build machine** (repo root — replace
`<github-username>` and `<VPS_IP>`):
```bash
docker build -f apps/backend/Dockerfile --target prod -t ghcr.io/<github-username>/hpl-command-center-backend:latest .
docker build -f apps/frontend/Dockerfile --target prod --build-arg NEXT_PUBLIC_API_URL=http://<VPS_IP>:4000 -t ghcr.io/<github-username>/hpl-command-center-frontend:latest .

docker push ghcr.io/<github-username>/hpl-command-center-backend:latest
docker push ghcr.io/<github-username>/hpl-command-center-frontend:latest
```
The frontend build still needs `NEXT_PUBLIC_API_URL` as a build arg, same reason as always (baked
into the browser bundle at build time) — just supplied directly here since this step doesn't go
through Compose or read `.env`.

**One-time, after the first push:** new GHCR packages default to Private. Make both Public so the
VPS can pull without its own login — on GitHub: your profile → Packages → select the package →
Package settings → Change visibility → Public. (Keeping them Private and running `docker login
ghcr.io` on the VPS too, with a read-only token, also works — Public is simpler when the repo
itself is already public.)

**On the VPS**, pull and run — note this uses `docker-compose.deploy.yml`, not
`docker-compose.prod.yml`:
```bash
git pull origin feature/multi-tenant-saas-foundation   # get docker-compose.deploy.yml if you don't have it yet

docker compose -f docker/docker-compose.deploy.yml --env-file .env pull

docker compose -f docker/docker-compose.deploy.yml --env-file .env up -d postgres
docker compose -f docker/docker-compose.deploy.yml --env-file .env ps

docker compose -f docker/docker-compose.deploy.yml --env-file .env run --rm backend npx prisma migrate deploy

# Seed demo data — gives you working login credentials to verify the deploy end-to-end.
# This is fabricated demo data (~500 orders, 30 dealers, a handful of architects/builders, etc.)
# for a clean-start deploy; skip this if/when restoring a real DB dump instead.
docker compose -f docker/docker-compose.deploy.yml --env-file .env run --rm backend npm run db:seed

docker compose -f docker/docker-compose.deploy.yml --env-file .env up -d
```

### Phase 6B — Build directly on the VPS (alternative, needs real headroom)

Only do this if the VPS genuinely has spare CPU/RAM beyond what's already running on it (check
Phase 0's numbers again with that in mind), and swap is already set up per Phase 2.

Build the two application images **one at a time**, not together — `docker compose build` with no
service name builds everything in parallel, and a concurrent Next.js + Nest build is exactly what
caused the OOM incident in the first place. Sequential caps peak memory to one build's worth
instead of both at once — do this even with swap in place, it's extra insurance, not a substitute:

```bash
# 1. Build images — one service at a time
docker compose -f docker/docker-compose.prod.yml --env-file .env build backend
docker compose -f docker/docker-compose.prod.yml --env-file .env build frontend

# 2. Start Postgres only, wait for "healthy"
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d postgres
docker compose -f docker/docker-compose.prod.yml --env-file .env ps

# 3. Run migrations (one-off container; exits when done)
docker compose -f docker/docker-compose.prod.yml --env-file .env run --rm backend npx prisma migrate deploy

# 4. Seed demo data — same caveat as 6A above
docker compose -f docker/docker-compose.prod.yml --env-file .env run --rm backend npm run db:seed

# 5. Start everything
docker compose -f docker/docker-compose.prod.yml --env-file .env up -d
```

## Phase 7 — Verify

Use whichever compose file you actually deployed with — `docker-compose.deploy.yml` for 6A,
`docker-compose.prod.yml` for 6B:
```bash
docker compose -f docker/docker-compose.deploy.yml --env-file .env ps      # all "Up"
docker compose -f docker/docker-compose.deploy.yml --env-file .env logs backend --tail 50
```

From a browser: `http://<VPS_IP>:<frontend port>` → log in with `owner@hplmaker.demo` /
`Passw0rd!123` (full seeded-user list in the main README).

**Login succeeds but immediately bounces back to the login page** → `CORS_ORIGIN` and/or
`NEXT_PUBLIC_API_URL` don't match what you're actually visiting. Fix `.env`, then:
- **6B (built on the VPS):**
  ```bash
  docker compose -f docker/docker-compose.prod.yml --env-file .env up -d --build frontend
  ```
- **6A (prebuilt image):** `NEXT_PUBLIC_API_URL` is baked into the image itself, so fixing `.env`
  on the VPS alone isn't enough — rebuild and push from the build machine with the corrected
  value (Phase 6A's frontend `docker build --build-arg` command), then on the VPS:
  ```bash
  docker compose -f docker/docker-compose.deploy.yml --env-file .env pull frontend
  docker compose -f docker/docker-compose.deploy.yml --env-file .env up -d frontend
  ```

Either way, a plain restart alone won't pick up the new value — it's baked in at build time, not
read at container start.

**Backend container keeps restarting** → check `logs backend`; almost always means Phase 6's
migrations step didn't run or didn't finish before `up -d`.

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
