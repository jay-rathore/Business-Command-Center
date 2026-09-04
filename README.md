# HPL Maker — Business Owner Command Center

A Unified Business Intelligence, CRM, Sales, Dealer & Project Intelligence Platform for HPL
Manufacturing & Distribution. This is the production application — a real, database-backed,
multi-user, multi-tenant web platform — built from the validated design in `../demo/`.

**Live modules**: Authentication & RBAC, the application shell, Command Center (dashboard),
Sales, Sales Team (per-executive performance, leaderboard, follow-up risk), Leads (incl.
business-card scan capture + CRM sync), Dealers, Architects, Builders (referral partner
directories — projects/leads/samples/revenue influenced), Projects, Products, Customers,
Quotations (manual + Chat-AI + Voice-AI generation, PDF, WhatsApp/email send), and
Marketing — campaign performance across Meta Ads, Google Ads, GA4 and Search Console, plus a
Traffic Intelligence layer (root-cause analysis, AI recommendations, a proactive digest, and
drill-down investigation) under Marketing → Website & Search. There's also a cross-tenant
Platform Admin section (organization onboarding, activation, admin password reset) gated behind
a separate `isPlatformAdmin` flag on the user, not a regular role, plus Notifications (bell
dropdown + full page, role-scoped). Settings is partly live — Company Profiles and per-tenant
Integration Connections (the credentials the sync services above read) are real; user
administration/permissions/audit-log within Settings is still "Coming soon".

The remaining modules — Complaints, Warranty, Geography, AI Insights, Reports — still render a
plain "Coming soon" state.

## Tech stack

| Layer | Details |
|---|---|
| Frontend | Next.js 16 (Turbopack), TypeScript, App Router, Tailwind CSS 4, React Query, Recharts |
| Backend | NestJS, REST APIs, class-validator, JWT auth |
| Database | PostgreSQL via Prisma ORM — 45 models, multi-tenant (every row scoped to an `Organization`) |
| Shared | `@hpl/shared` — enums/types shared between frontend and backend |
| Integrations | Meta Ads, Google Ads, GA4, Search Console (live sync), OpenAI (quotation parsing), WhatsApp Cloud API + SMTP (send), HPL CRM (lead sync), WooCommerce (planned) — credentials stored per-tenant, AES-256-GCM encrypted, in `IntegrationConnection` |
| Infra | Docker Compose (dev), npm workspaces monorepo |

## Project structure

```
apps/backend/      NestJS API — one module per domain:
                      auth, rbac, architects, builders, company-profiles, customers, dashboard,
                      dealers, integration-connections, integrations (email, whatsapp), leads
                      (+ crm-sync, scan-card), marketing (+ meta-ads-sync, google-ads-sync,
                      google-analytics-sync, search-console-sync, traffic-intelligence),
                      notifications, platform-admin, products, projects, quotations, sales,
                      sales-team
                    + prisma/schema.prisma + prisma/seed.ts
apps/frontend/      Next.js App Router — (auth)/login, (app)/{dashboard,sales,leads,marketing,
                     quotations,platform-admin,...}
packages/shared/    Hand-mirrored enums + API response types, built to dist/ before use
docker/             docker-compose.yml (postgres + backend + frontend + adminer)
```

## Local development

### Option A — Docker Compose (recommended for a clean clone)

```bash
# 1. Copy the env template and adjust if needed (defaults work out of the box)
cp .env.example .env

# 2. Build and start everything
docker compose -f docker/docker-compose.yml --env-file .env up --build -d

# 3. Run migrations and seed demo data (first time only)
docker exec hpl-command-center-backend-1 npx prisma migrate deploy
docker exec hpl-command-center-backend-1 npm run db:seed
```

Then open:
- **App**: http://localhost:3005
- **API + Swagger docs**: http://localhost:4000/api/docs
- **Adminer** (DB browser): http://localhost:8080 — server `postgres`, credentials from `.env`

Ports are deliberately non-default (**5433** for Postgres, **3005** for the frontend) to avoid
colliding with other projects that may already be running on 5432/3000 on the same machine.

### Option B — Native dev (faster iteration, no container rebuild on every change)

```bash
npm install                                  # installs all workspaces, builds @hpl/shared
docker compose -f docker/docker-compose.yml --env-file .env up -d postgres   # DB only

npm run prisma:migrate:dev                   # first time / after schema changes
npm run db:seed                              # first time

npm run dev:backend     # in one terminal — http://localhost:4000
npm run dev:frontend    # in another — http://localhost:3005
```

Native dev needs `apps/frontend/.env.local` (gitignored) pointing both `NEXT_PUBLIC_API_URL`
and `INTERNAL_API_URL` at `http://localhost:4000` — Docker Compose overrides these itself, so
this file only matters when running the frontend outside a container.

Similarly, `apps/backend/.env` (gitignored, holds all the real integration secrets) is written
for native dev — its `DATABASE_URL` points at the host-mapped Postgres port. Since it's
bind-mounted into the backend container and `main.ts` loads it with `dotenv`'s `override: true`,
Docker Compose shadows just that one file with `apps/backend/.env.docker.local` (same secrets,
`DATABASE_URL` pointed at the `postgres` service instead) — see the volumes block in
`docker/docker-compose.yml`. Keep both files' non-DB values in sync when you rotate a secret.

### Troubleshooting

- **`Ports are not available` on `docker compose up`** — something on the host is already bound
  to 4000/3005/5433/8080, most often a leftover native `dev:backend`/`dev:frontend` process that
  didn't get killed. Find it (`Get-NetTCPConnection -LocalPort <port> -State Listen` on Windows,
  then `Get-Process -Id <pid>`) and stop it, then re-run `up`.
- **Backend container exits with `FATAL ERROR: Reached heap limit ... JavaScript heap out of
  memory`** — `nest start --watch`'s first compile can peak around 3GB, above Node's default
  ~2GB heap ceiling. `docker/docker-compose.yml` already sets `NODE_OPTIONS:
  --max-old-space-size=4096` on the backend service to cover this; if it still happens, make sure
  Docker Desktop itself has at least ~6GB of memory allocated (Settings → Resources).
- **Backend logs `Can't reach database server at localhost:5433`** — the `.env.docker.local`
  shadow above isn't mounted (e.g. you removed it or renamed the file). Recreate it from
  `apps/backend/.env` with `DATABASE_URL` pointed at `postgres:5432`, then `docker compose up -d
  backend`.

## Deploying

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for a full VPS deployment runbook (Docker Compose
using each Dockerfile's `prod` target, a pre-flight check for conflicting services on a shared
box, and the deploy-blocking gaps already found and fixed).

## Demo credentials

All seeded users share one password: **`Passw0rd!123`**

| Email | Role |
|---|---|
| `owner@hplmaker.demo` | Owner — full access |
| `admin@hplmaker.demo` | Admin — full access |
| `sales.manager@hplmaker.demo` | Sales Manager |
| `sales.exec@hplmaker.demo` | Sales Executive |
| `marketing@hplmaker.demo` | Marketing Manager |
| `dealer.manager@hplmaker.demo` | Dealer Manager |

Seed data is realistic but fabricated (Indian HPL-business names, ~500 orders, 30 dealers, 180
leads, 38 projects). See `apps/backend/prisma/seed.ts` — it's idempotent, safe to re-run.
Marketing is the exception: Meta Ads, Google Ads, GA4 and Search Console rows come exclusively
from the live sync services once an org connects those providers under Settings — the seed script
deliberately never fabricates them, so there's no collision between seeded and real rows.

## Useful commands (from repo root)

```bash
npm run build:shared      # rebuild packages/shared — required after editing its source
npm run build:backend     # type-check + compile the NestJS API
npm run build:frontend    # type-check + build the Next.js app
npm run prisma:migrate:dev
npm run db:seed
```

## Notes for whoever picks this up next

- `apps/backend/prisma/schema.prisma` is the source of truth for the full data model — 45 models
  are defined now, covering both the live modules above and the still-stubbed ones, even though
  only the live subset has working APIs/UI.
- Multi-tenancy is enforced at the data layer: every tenant-owned model carries an
  `organizationId`, and a Prisma extension (`src/prisma/org-scope.extension.ts`) reads the
  current tenant out of `AsyncLocalStorage` (populated per-request from the authenticated user)
  to scope queries automatically. One-off scripts (seed, `set-platform-admin.ts`) have no request
  context, so they set `organizationId` explicitly instead of relying on the extension.
- Business logic that isn't a simple query lives in dedicated services, not controllers:
  `DealerScoringService` (health score), `LeadScoringService` (lead score),
  `ProjectPipelineService`-equivalent logic in `projects.service.ts` (stuck/closing-soon),
  and `BusinessHealthService`/`AttentionFeedService`/`ContributorsService` for the dashboard.
- Two ports exist specifically so a real LLM can be swapped in via DI without touching the
  controller: `InsightGeneratorPort` (dashboard AI Executive Summary, currently
  `RuleBasedInsightGenerator`) and `TrafficNarrativePort` (Traffic Intelligence's prose layer) —
  the latter only ever rephrases an already-computed `TrafficInvestigationResult`, never invents
  or alters a number.
- Per-tenant third-party credentials (Meta, Google Ads, GA4, Search Console, WhatsApp, email,
  CRM, etc.) live encrypted in `IntegrationConnection` (AES-256-GCM, see
  `src/common/crypto/integration-credentials.ts`), configured per org under Settings →
  Integrations. Sync/send services read only from there now, never from `ConfigService`/env —
  the credentials in `apps/backend/.env` are this HPL Maker tenant's own, moved into its
  `IntegrationConnection` rows by the one-time `npm run db:migrate-env-to-connections -w
  apps/backend` (`apps/backend/prisma/migrate-env-to-connections.ts`); a fresh tenant just uses
  the Settings UI.
- No real business data has been imported for most modules — sales/leads/dealers/projects/
  products/customers are still seed data (see the seed script's header comments before doing a
  real-data import; the schema shouldn't need to change for it). Marketing is the one exception,
  already running on live synced data — see the note under Demo credentials above.
