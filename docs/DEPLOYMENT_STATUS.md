# Deployment Status — Tomer + Dashboard

**Last updated:** 2026-08-28
**Repository:** `ido318/mvp-noa-1-0`
**Supabase project:** `xpsuhtqfxqmnunppnyov` (`eu-central-1`)

This document records the production/preview operations completed on
2026-08-28. It intentionally contains no secrets.

---

## Code Review Fixes

Two local commits were pushed to `origin/main`:

| Commit | Summary |
|---|---|
| `7940aae` | Harden auth and clean dashboard quality issues |
| `fbedc1d` | Run integration tests against local Supabase |

Key fixes included:

- Constant-time bearer token comparison for protected `agent` job/tool routes.
- Dashboard lint and React transition cleanup.
- Visit share token TTL reduced from 30 days to 7 days.
- Dev seed script no longer prints the dev password.
- Integration tests now force local Supabase env values through
  `app/scripts/with-supabase-env.sh`.

---

## Verification

The following checks passed before deployment:

```bash
npm run test:all
npm run test:integration --workspace=app
npm run build --workspace=agent
npm run build --workspace=app
npm run lint --workspace=agent
npm run lint --workspace=app
npm run typecheck:all
npm audit --workspaces
```

Observed results:

- Agent unit tests: `267` passed.
- App unit tests: `135` passed, `15` skipped.
- App integration tests: `15` passed.
- Dependency audit: `0` vulnerabilities.

---

## Supabase

Remote migration history was repaired after the live schema was verified to
already contain the expected migration effects.

Verified remote schema state:

- `notifications_log.vaccination_id` exists.
- `vaccination_reminder` is allowed in `notifications_log.type`.
- `notifications_log_vaccination_id_required` exists.
- `notifications_log_vaccination_type_unique` exists.
- Existing `vaccination_reminder` rows: `0`.

Final verification:

```bash
supabase migration list --linked
supabase db push --linked --dry-run
```

Result: local and remote migration history are aligned, and the remote database
is up to date.

---

## Vercel Dashboard

Dashboard deployment:

| Field | Value |
|---|---|
| Vercel project | `get-a-vrt-d` |
| Production URL | `https://voxly-app-chi.vercel.app` |
| Latest preview URL | `https://get-a-vrt-r01qvhniy-ido318s-projects.vercel.app` |
| Deployment ID | `dpl_HZ1VWBNkD2vkPxC66D4ZGCQBrxAs` |
| Status | `READY` |

Note: the first preview deploy was started from `app/` and failed because the
Vercel project already has `Root Directory = app`. The successful deploy was
started from the repository root.

---

## Fly.io Agent

Agent deployment:

| Field | Value |
|---|---|
| Fly app | `voxly-agent` |
| URL | `https://voxly-agent.fly.dev` |
| Health URL | `https://voxly-agent.fly.dev/health` |
| Region | `fra` |
| Machine | `4d895799f101d8` |
| Machine version | `33` |
| Image | `voxly-agent:deployment-01M135WVERW4GAEGFGA881H9PG` |
| Runtime env | `NODE_ENV=production` |

Verification:

```bash
flyctl status --app voxly-agent
curl -i https://voxly-agent.fly.dev/health
```

Result: Fly deployment and smoke checks passed, DNS was verified, and
`/health` returned HTTP `200` with `status: "ok"`.

`https://voxly-agent.fly.dev/` returns `404` because the agent is an API service
and does not define a root page. This is expected.

---

## Still Open

- Decide whether to promote the latest Vercel preview to production.
- Confirm Twilio Voice webhook still points to
  `https://voxly-agent.fly.dev/twilio/voice`.
- Confirm ElevenLabs post-call webhook still points to
  `https://voxly-agent.fly.dev/hooks/call-ended`.
- Activate or verify scheduled `pg_cron` jobs only after confirming the desired
  production behavior for automatic SMS reminders.
