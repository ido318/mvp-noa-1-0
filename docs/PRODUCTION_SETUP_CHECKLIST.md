# צ׳ק-ליסט הפעלה לפרודקשן — Tomer + Dashboard

מסמך זה מרכז **כל מה שצריך ממך** כדי שאפעיל את הסוכן (agent) ואת הדשבורד (app) בפרודקשן.
סטטוס הפריסה המעודכן נמצא גם ב-`docs/DEPLOYMENT_STATUS.md`.
ערכים שכבר שלפתי מסומנים ✅. ערכים סודיים שרק אתה יכול להוציא מסומנים 🔒.

> קובץ זה (מתועד ב-git) משתמש ב-placeholders בלבד. הערכים האמיתיים נמצאים ב-
> `docs/PRODUCTION_SETUP_CHECKLIST.local.md` (מקומי, מוחרג ב-`.gitignore`, לא נכנס לגיט).

> טיפ לשימוש עם תוסף Chrome של קלוד: כל שורה 🔒 כוללת בדיוק לאן להיכנס ומה להעתיק.

---

## חלק 1 — התחברויות שאני צריך (בטרמינל אינטראקטיבי אצלך)

בלי אלה אני לא יכול לפרוס בכלל:

```bash
vercel login
```
```bash
flyctl auth login
```

לאחר שתתחבר — תגיד לי, ואני מפריס את שני החלקים עם הקוד החדש ומגדיר את משתני הסביבה.

---

## חלק 2 — ערכים שכבר יש לי (לא צריך לחפש) ✅

| משתנה | ערך | שייך ל |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | `https://<SUPABASE_PROJECT_REF>.supabase.co` | app + agent |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `<SUPABASE_ANON_KEY>` | app |
| `AGENT_CLINIC_ID` | `<AGENT_CLINIC_ID>` (Get A Vet) | agent |
| `PUBLIC_BASE_URL` (agent) | `<AGENT_FLY_URL>` | agent |
| `APP_BASE_URL` (app) | `<APP_VERCEL_URL>` | app |

---

## חלק 3 — סודות שצריך להוציא 🔒

### 3.1 Supabase — לוח בקרה
🔗 https://supabase.com/dashboard/project/`<SUPABASE_PROJECT_REF>`/settings/api

| משתנה | איפה בדיוק | פורמט |
|---|---|---|
| 🔒 `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → מפתח **`service_role`** (לחיצה על "Reveal") | `eyJ...` (JWT ארוך) |

> ⚠️ זה מפתח-על — לא לשתף בשום מקום ציבורי. משמש גם ל-app וגם ל-agent.

### 3.2 Twilio — Console
🔗 https://console.twilio.com

| משתנה | איפה בדיוק | פורמט |
|---|---|---|
| 🔒 `TWILIO_ACCOUNT_SID` | דף הבית של ה-Console → Account Info | `AC` + 32 תווים |
| 🔒 `TWILIO_AUTH_TOKEN` | דף הבית → Account Info → "Auth Token" (Show) | מחרוזת ארוכה |
| `TWILIO_PHONE_NUMBER` (agent) / `TWILIO_CLINIC_PHONE_NUMBER` (app) | Phone Numbers → Active numbers — המספר הישראלי | `+972...` |

### 3.3 ElevenLabs — Conversational AI
🔗 https://elevenlabs.io/app/conversational-ai

| משתנה | איפה בדיוק | פורמט |
|---|---|---|
| 🔒 `ELEVENLABS_API_KEY` | תמונת הפרופיל → API Keys | `sk_...` או `xi-...` |
| `ELEVENLABS_AGENT_ID` | Conversational AI → הסוכן "תומר" → מזהה הסוכן בכתובת/בהגדרות | מחרוזת |
| 🔒 `ELEVENLABS_WEBHOOK_SECRET` | הגדרות ה-post-call webhook של הסוכן | מחרוזת סוד |

### 3.4 OpenAI — לסיכומי ביקור עם AI (ל-app)
🔗 https://platform.openai.com/api-keys

| משתנה | הערה | פורמט |
|---|---|---|
| 🔒 `OPENAI_API_KEY` | דרוש רק לפיצ׳ר סיכום ביקור אוטומטי | `sk-...` |

---

## חלק 4 — ערכים שאתה מחליט / מייצר

| משתנה | מה זה | איך משיגים |
|---|---|---|
| `HUMAN_HANDOFF_NUMBER` (agent) | הנייד של נועה, שאליו תומר יעביר שיחות בשעות הפעילות | הנייד של נועה בפורמט `+9725...` |
| `JOBS_BEARER_TOKEN` (agent) | סוד שמגן על נתיבי ה-`/jobs` (מינימום 16 תווים) | ליצור אקראי: `openssl rand -hex 24` |
| `TOOLS_BEARER_TOKEN` (agent) | סוד נפרד שמגן על נתיבי ה-`/tools` של ElevenLabs (מינימום 16 תווים) | ליצור אקראי שונה: `openssl rand -hex 24` |
| `HEALTH_CHECK_TOKEN` (app, אופציונלי) | מאפשר `/api/health` מפורט עם DB/env דרך `Authorization: Bearer ...`; בלי הטוקן ה-endpoint מחזיר liveness ציבורי בלבד | ליצור אקראי שונה: `openssl rand -hex 24` |
| `DEV_USER_EMAIL` / משתמש התחברות לדשבורד | המשתמש שנועה תתחבר איתו | אם אין — אני יכול ליצור משתמש דרך Supabase Auth |

---

## חלק 5 — הגדרות חיצוניות (לא env — פעולות בקונסולות)

- [ ] **Twilio:** `voice_url` של המספר → `https://api.elevenlabs.io/twilio/inbound-call` (אינטגרציית ElevenLabs הנייטיבית). **לא** להפנות ל-`<AGENT_FLY_URL>/twilio/voice` — זה שבר שיחות בעבר.
- [ ] **ElevenLabs:** post-call webhook → `<AGENT_FLY_URL>/hooks/call-ended` (עם `ELEVENLABS_WEBHOOK_SECRET`)
- [ ] **ElevenLabs:** הגדרת transfer-to-number לפיצ׳ר ההעברה לאדם (הכלי החדש `request-human-handoff` יסונכרן ע״י סקריפט הסנכרון)
- [ ] **Fly.io:** להוסיף כרטיס אשראי אם החשבון עדיין במסלול Trial
- [ ] **Supabase:** להפעיל pg_cron לתזכורות SMS (ה-SQL קיים ב-CLAUDE.md)

---

## חלק 6 — ערכי ברירת מחדל שאני אגדיר בעצמי בפרודקשן

לא צריך ממך — אני מגדיר: `NODE_ENV=production`, `APP_ENV=production`, `DEMO_MODE=false`, `TWILIO_VALIDATE_SIGNATURE=true`, `PORT=3000`, `LOG_LEVEL=info`.

---

## הסדר שבו נעבוד

1. בוצע: קוד תוקן, נבדק, נדחף ל-GitHub, ונפרס ל-Vercel/Fly.
2. פתוח: לקדם את ה-preview של Vercel ל-production אם רוצים שהדומיין הקבוע יקבל את הגרסה החדשה.
3. פתוח: לאמת בקונסולות ש-Twilio ו-ElevenLabs מצביעים ל-`https://voxly-agent.fly.dev`.
4. יחד: שיחת בדיקה מקצה-לקצה (9 התרחישים במסמך ה-E2E).
