# HPL Maker — Business Owner Command Center

A Unified Business Intelligence, CRM, Sales, Dealer & Project Intelligence Platform for HPL
Manufacturing & Distribution. This is the production application — a real, database-backed,
multi-user web platform — built from the validated design in `../demo/`.

**Phase 1 (this build)** covers: Authentication & RBAC, the application shell, and six modules —
Command Center, Sales, Leads, Dealers, Projects, Products. The remaining 12 modules render a
"Coming soon" state and ship in later phases.

## Tech stack

| Layer | Details |
|---|---|
| Frontend | Next.js 16, TypeScript, App Router, Tailwind CSS 4, React Query, Recharts |
| Backend | NestJS, REST APIs, class-validator, JWT auth |
| Database | PostgreSQL via Prisma ORM |
| Shared | `@hpl/shared` — enums/types shared between frontend and backend |
| Infra | Docker Compose (dev), npm workspaces monorepo |

## Project structure

```
apps/backend/     NestJS API (one module per domain: auth, sales, leads, dealers, projects,
                   products, dashboard) + prisma/schema.prisma + prisma/seed.ts
apps/frontend/     Next.js App Router — (auth)/login, (app)/{dashboard,sales,leads,...}
packages/shared/   Hand-mirrored enums + API response types, built to dist/ before use
docker/            docker-compose.yml (postgres + backend + frontend + adminer)
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

## Useful commands (from repo root)

```bash
npm run build:shared      # rebuild packages/shared — required after editing its source
npm run build:backend     # type-check + compile the NestJS API
npm run build:frontend    # type-check + build the Next.js app
npm run prisma:migrate:dev
npm run db:seed
```

## Notes for whoever picks this up next

- `apps/backend/prisma/schema.prisma` is the source of truth for the full data model — all ~30
  entities across all 4 phases are defined now, even though only Phase 1's subset has working
  APIs/UI.
- Business logic that isn't a simple query lives in dedicated services, not controllers:
  `DealerScoringService` (health score), `LeadScoringService` (lead score),
  `ProjectPipelineService`-equivalent logic in `projects.service.ts` (stuck/closing-soon),
  and `BusinessHealthService`/`AttentionFeedService`/`ContributorsService` for the dashboard.
- The AI Executive Summary on the dashboard is rule-based (`RuleBasedInsightGenerator`), sitting
  behind an `InsightGeneratorPort` interface specifically so a real LLM can be swapped in later
  via DI without touching the controller.
- No real business data has been imported yet — everything is seed data. See the seed script's
  header comments before doing a real-data import; the schema shouldn't need to change for it.
