# mvp-noa-1-0

**Tomer** — Voice AI Agent + Vet Clinic Dashboard for Dr. Noa Cabasheny (Get A Vet).

Unified monorepo. Two packages, one Supabase project.

---

## Packages

| Package | Directory | Runtime | Deploy |
|---|---|---|---|
| **agent** | `agent/` | Node.js 20 + Hono | Vercel (voxly-agent) |
| **app** | `app/` | Next.js 16 | Vercel (voxly-app) |

Shared: `supabase/` migrations, `docs/`.

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- Supabase CLI (`npm i -g supabase`)
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
npm run test:agent     # agent only (3 unit tests)
npm run test:app       # app only (19 unit + integration tests)
```

---

## Architecture

```
[Caller phone]
      ↓
[Twilio Israeli number]
      ↓ POST /twilio/voice
[agent/ — Hono server]
      ↓ ElevenLabs signed URL
[ElevenLabs Conversational AI — Tomer]
      ↓ Hebrew conversation
      ├── POST /tools/lookup-customer  → customers + pets (Supabase)
      └── POST /tools/escalate-to-noa → escalations (Supabase)
      ↓ call ends
[POST /hooks/call-ended]
      ↓ upsert
[voice_calls table — visible in dashboard]

[app/ — Next.js dashboard]
      └── /dashboard/voice   ← shows voice_calls + escalations
```

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

Migrations in `supabase/migrations/`. Run in order (filename = timestamp).

Latest: `20260611000012_agent_schema.sql` — adds `escalations` table, `elevenlabs_conversation_id` + `agent_name` to `voice_calls`.

---

## Source of Truth

See [docs/VOXLY_SOURCE_OF_TRUTH.md](docs/VOXLY_SOURCE_OF_TRUTH.md).

## Original Repos (read-only archive)
- `noa-new` → veterinary CRM (phases 1–6)
- `voxly-maya` → voice agent server (Hono + ElevenLabs)
