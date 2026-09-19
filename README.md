# mvp-noa-1-0

**Tomer** — Voice AI Agent + Vet Clinic Dashboard for Dr. Noa Cabasheny (Get A Vet).

Unified monorepo. Three npm workspaces, one Supabase project.

---

## Packages

| Package | Directory | Runtime | Deploy |
|---|---|---|---|
| **agent** | `agent/` | Node.js 22 + Hono | Fly.io (`voxly-agent`) |
| **app** | `app/` | Next.js 16 | Vercel (`get-a-vrt-d` / `voxly-app-chi`) |
| **@tomer/shared** | `packages/shared/` | compiled TypeScript | imported by agent + app |

Shared: `supabase/` migrations, `docs/`.

Auth on tool endpoints is a **Bearer token** (`TOOLS_BEARER_TOKEN`), not ElevenLabs HMAC. HMAC is used on `/hooks/call-ended` only.

Production Twilio `voice_url` is ElevenLabs native inbound (`https://api.elevenlabs.io/twilio/inbound-call`). Do not point the live number at `agent/` `/twilio/voice`.

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- Supabase CLI (`npm i -g supabase`, or run `.cursor/install.sh`)
- Twilio account + Israeli phone number
- ElevenLabs account + agent configured

### Setup

```bash
# 1. Clone
git clone https://github.com/ido318/mvp-noa-1-0.git
cd mvp-noa-1-0

# 2. Install all workspaces
npm install

# 3. Start local Supabase
cd supabase && supabase start
cd ..

# 4. Seed local DB
cd app
cp .env.example .env.local     # fill in supabase status values
npm run seed:all

# 5. Run agent (new terminal)
cd agent
cp .env.example .env           # fill in all values
npm run dev

# 6. Run dashboard (new terminal)
cd app
npm run dev                    # http://localhost:3001
```

### Tests

```bash
npm run test:all       # both agent and app
npm run test:agent     # agent only
npm run test:app       # app unit tests
npm run typecheck:all
npm run lint:all
npm run build:all
```

### Production Deployments

Current deployment status is tracked in
[`docs/DEPLOYMENT_STATUS.md`](docs/DEPLOYMENT_STATUS.md).

```bash
# Dashboard preview deploy (Vercel, project root is app/)
vercel deploy

# Agent production deploy (Fly.io)
cd agent
flyctl deploy --app voxly-agent
```

---

## Architecture

```
[Caller phone]
      ↓
[Twilio Israeli number]
      ↓ voice_url = https://api.elevenlabs.io/twilio/inbound-call
        (ElevenLabs native inbound; do NOT point Twilio at /twilio/voice)
[ElevenLabs Conversational AI — Tomer]
      ↓ Hebrew conversation
      ├── POST /tools/lookup-customer  → customers + pets (Supabase)
      └── POST /tools/escalate-to-noa → escalations (Supabase)
      ↓ call ends
[POST /hooks/call-ended]
      ↓ upsert
[voice_calls table — visible in dashboard]

[app/ — Next.js dashboard]
      └── /dashboard/calls   ← shows voice_calls + escalations
                                 (/dashboard/voice/[callId] is the single-call view,
                                  opened from the pre-visit brief)
```

`agent/src/server/routes/twilio.ts` (`/twilio/voice`, `/twilio/status`) is kept as a fallback only and is **not** wired to the live number. Repointing Twilio at the agent previously silenced Tomer.

---

## Environment Variables

See `agent/.env.example` and `app/.env.example`.

**Shared between both** (same Supabase project):
- `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Agent only:** `ELEVENLABS_*`, `AGENT_CLINIC_ID`, `PORT`, `LOG_LEVEL`, `PUBLIC_BASE_URL`

**App only:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `APP_ENV`

---

## Database

Migrations in `supabase/migrations/` (50+ files; run in timestamp order).

#20 recorded 51 applied migrations; this branch adds `20260919153000_increment_visit_share_view.sql`. Frozen SMS wording is 8 Hebrew templates in `@tomer/shared`. Booking SMS prices come from clinic `price_list_items` via `@tomer/shared` `pricing.ts` — not a hardcoded 150₪ map.

Dashboard session gating lives in `app/proxy.ts` (Next.js 16 proxy), not `middleware.ts`.

---

## Source of Truth

See [docs/VOXLY_SOURCE_OF_TRUTH.md](docs/VOXLY_SOURCE_OF_TRUTH.md) (Notion page `36f1354b584881b587c5c6f42a6bf6c7`).

## Original Repos (read-only archive)
- `noa-new` → veterinary CRM (phases 1–6)
- `voxly-maya` → voice agent server (Hono + ElevenLabs)
