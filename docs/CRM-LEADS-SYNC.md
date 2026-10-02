# HPL CRM ↔ Leads Sync — Investigation & Fix Log

Context saved 2026-09-28 covering the investigation into why the Leads module's totals
drifted from the live HPL CRM, what was fixed, and what's still open. Read this before
touching `crm-sync.service.ts` or planning the next phase (real-time/webhook sync).

## The problem

Dashboard showed **29,651** total leads while the live CRM (apiuatcrm.ultracreation.in)
showed **32,079** — a ~2,400 lead gap, plus stale statuses/notes on older leads.

## Root cause

The CRM API token in `apps/backend/.env` had gone dead (`401 Invalid token`), confirmed
by curling the live API directly. The scheduled sync (`CrmSyncService.scheduledSync`,
every 30 min) was failing on every run — silently, since the failure was only logged,
never surfaced anywhere. Investigation into the CRM's own repo
(`UltraCreation-IT-Solution/BLACK-HAT-SEO`) found why: the token belonged to a **regular
employee's personal browser-session token**, not a dedicated integration account.
Django REST Framework's `TokenAuthentication` doesn't expire tokens on a timer — but the
CRM's `ChangePasswordView` explicitly deletes a user's token on any self-service password
change (`Token.objects.filter(user=user).delete()`, to force re-login). The employee
almost certainly changed their password at some point, which silently killed our
integration.

A **second, structural** gap exists independent of the token: the sync only ever polls
`created_at_after=<date>` (a rolling recent window, default 3 days). A status/notes/
reassignment change on a lead older than that window is never re-fetched — this is not
fixed yet (see "Still open" below).

## What was fixed

1. **Dedicated service account created on the CRM side.** The CRM repo now has:
   - `User.is_service_account` flag (migration `0003_user_is_service_account`)
   - `ChangePasswordView` now refuses (403) instead of silently deleting the token when
     `is_service_account` is set
   - `create_integration_account` management command — creates an account with an
     unusable password, an elevated `CompanyMembership` role, and a token in one step
   - New token generated for a dedicated `hpl-command-center` integration account and
     confirmed working (`GET /api/leads/` → 200, `count: 32079` at the time).
   - **Known residual gap on the CRM side (not fixed, flagged only):** the OTP-based
     self-service password reset (`ResetPasswordView`) doesn't check
     `is_service_account`, so the account's password could still be reset via email OTP.
     Lower priority — ask if you want this closed too.

2. **Migrated off raw `.env` onto the same encrypted per-tenant credential store every
   other integration uses** (`IntegrationConnection`, AES-256-GCM encrypted):
   - Added `HPL_CRM` to `IntegrationProvider` enum (`schema.prisma`) — migration
     `20260924042112_add_hpl_crm_integration_provider`
   - Added `HplCrmCredentials { baseUrl, token }` to
     `apps/backend/src/integration-connections/credential-types.ts`
   - Added an `HPL_CRM` candidate to `prisma/migrate-env-to-connections.ts`
   - Added `HPL_CRM` to the frontend's provider enum/labels/form fields (
     `packages/shared/src/enums.ts`, `IntegrationsSettings.tsx`,
     `IntegrationConnectionForm.tsx`, `useIntegrationConnections.ts` — now manageable and
     visible from Settings → Integrations, same as Meta/Google/WooCommerce/etc.)
   - Ran `npm run db:migrate-env-to-connections` to move the new token in for HPL Maker

3. **Refactored `CrmSyncService` to the same multi-tenant pattern as
   `MetaAdsSyncService`/`GoogleAdsSyncService`:**
   - `scheduledSync()` now loops `connections.listActive(IntegrationProvider.HPL_CRM)`
     instead of assuming a single hardcoded org
   - Reads credentials via `IntegrationConnectionsService.decrypt()`, not
     `ConfigService.getOrThrow()`
   - Calls `connections.recordSuccess()` / `recordError()` on every run — sync failures
     are now visible on the connection row (Settings UI shows "Last sync failed"),
     instead of only appearing in a server log nobody watches
   - Added `fullResync(credentials)` — walks every CRM page with **no** date filter,
     upserting everything. Use this for the initial cutover, for recovering from an
     outage, or periodically as a drift backstop.
   - `CrmSyncController`'s manual `POST /api/leads/crm-sync/run` now takes `?full=true`
     to trigger `fullResync` instead of the normal recent-window `syncRecent`

4. **Ran the one-time full catch-up (`fullResync`)** — walked all 32,079 live leads
   (~19 minutes), closing the gap. Local total after: **32,093** (slightly ahead of the
   32,079 snapshot taken earlier, since new leads landed on the CRM during the run — a
   good sign, confirms we're now genuinely current, not just matching a stale number).

## Still open — the rest of the roadmap

Ranked roughly by priority/dependency:

1. **Precise incremental filter.** The CRM dev confirmed `/api/leads/` already supports
   `?ordering=-updated_at` and `?updated_at_after=YYYY-MM-DD`, but only at **date**
   granularity, not timestamp. Ask them to add a proper `updated_at__gte` filter
   accepting a full ISO timestamp (small change on their `LeadFilter`). Once available,
   switch `syncRecent` to use a stored "last successful sync" watermark instead of a
   fixed `daysBack` window — this closes the structural "old leads never get re-checked"
   gap without needing full webhooks.
2. **Drift/reconciliation alert.** Add a scheduled check comparing our `Lead.count()`
   against the CRM's own `count` field (confirmed present on every list response — see
   `CrmLeadListResponse.count`, already read in `crm-sync.service.ts`) and fire a
   `NotificationsService` alert if they diverge past a threshold. This is the check that
   would have caught the original outage automatically instead of a human eyeballing two
   dashboards weeks later. Not yet implemented.
3. **Failure alerting.** `recordError()` now records the failure on the connection row,
   but nothing actively pings anyone yet. Consider firing a notification after N
   consecutive failures.
4. **Real live sync (webhooks).** The CRM has no general webhook/subscriber system today
   — only one hardcoded integration (Klevo AI: status-change only, 4 fields, no
   signing, no retries, drops silently on failure). Since the CRM is fully owned/managed
   internally, the plan is to extend that same mechanism: fire on create/status/
   notes/reassignment/any field change, send full lead data (or at least the ID) with a
   signed payload, add retries + dead-letter handling. This is real engineering scope on
   the CRM side, not a quick toggle — treat as a proper roadmap item, not a bridge fix.
   Even once built, keep the reconciliation check (#2) as a safety net — a missed webhook
   delivery is still possible.
5. **Frontend live-feel.** Today the Leads page only fetches on mount/navigation — no
   auto-refresh, no push to the browser (checked `useLeads.ts`). Even with instant
   backend sync, a user with the page already open won't see changes without a manual
   refresh. Decide later whether to add polling refetch or a push mechanism.
6. **Field completeness pass**, once live data can be spot-checked again: CRM records
   have `job_title`, `repeated_lead`/`repeat_count`, `assigned_at`, and per-note
   `added_by`/`created_at` that we currently either ignore or flatten into one notes
   blob. Worth capturing individually if useful for lead scoring / rep response-time
   metrics later.

## Key files touched

- `apps/backend/src/leads/crm-sync/crm-sync.service.ts` — core sync logic
- `apps/backend/src/leads/crm-sync/crm-sync.controller.ts` — manual trigger endpoint
- `apps/backend/src/leads/crm-sync/crm-lead-mapper.ts` — CRM → our schema field mapping
  (shared with `prisma/import-crm-snapshot.ts`, the original one-time backfill)
- `apps/backend/src/leads/crm-sync/crm-status-classification.ts` — CRM status name →
  OPEN/WON/LOST stage mapping; also excludes the CRM's "Hr" department statuses
- `apps/backend/src/integration-connections/credential-types.ts` — `HplCrmCredentials`
- `apps/backend/prisma/migrate-env-to-connections.ts` — one-time env→DB credential move
- `apps/backend/prisma/schema.prisma` — `IntegrationProvider.HPL_CRM`, `Lead` model
- `packages/shared/src/enums.ts` — shared `IntegrationProvider` enum
- `apps/frontend/components/settings/IntegrationsSettings.tsx` /
  `IntegrationConnectionForm.tsx` / `apps/frontend/lib/query/useIntegrationConnections.ts`

## Reference

- Live CRM: `https://apiuatcrm.ultracreation.in` (a UAT-named host — worth confirming
  with the CRM team whether this is actually their production environment or a staging
  one; hasn't been asked directly)
- CRM's own repo: `github.com/UltraCreation-IT-Solution/BLACK-HAT-SEO` (Django + DRF).
  Local copies also exist at `D:\Business Dashboard\BLACK-HAT-SEO-repo` and
  `BLACK-HAT-SEO-production` on this machine — note these were found to be **out of
  sync with the real repo** at one point (an `AdminResetUserPasswordView` found locally
  didn't exist when checked against the live repo) — don't trust local copies over a
  fresh clone/check.
- CRM auth: DRF `TokenAuthentication`, header `Authorization: Token <key>`
