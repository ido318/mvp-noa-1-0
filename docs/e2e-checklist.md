# E2E Readiness Checklist — Tomer Voice Agent

**Last updated:** 2026-06-12  
**Agent:** https://voxly-agent.fly.dev  
**Dashboard:** https://voxly-app-chi.vercel.app  
**Supabase:** xpsuhtqfxqmnunppnyov (eu-central-1)

---

## Pre-flight (infrastructure)

- [x] `voxly-agent` deployed to Fly.io (Node 22, 1 machine, fra)
- [x] All 16 fly secrets set (ELEVENLABS_WEBHOOK_SECRET updated 2026-06-12)
- [x] 7 ElevenLabs tools synced → fly.dev URLs
- [x] HMAC: signed requests → 200; unsigned → 401/403
- [x] `voxly-app` deployed to Vercel — login page returns 200
- [x] pg_cron job `process-sms-notifications` active (every 15 min)
- [x] Twilio Voice webhook → `https://voxly-agent.fly.dev/twilio/voice`
- [x] ElevenLabs post-call webhook → `https://voxly-agent.fly.dev/hooks/call-ended`
- [ ] **Fly.io billing** — add credit card to prevent 5-min trial shutdowns

---

## תרחיש 1 — שיחה נכנסת, לקוח קיים

**תנאי מקדים:** לקוח עם טלפון תקני קיים בטבלת `customers`.

1. חייג מה-Twilio CLI / טלפון אמיתי למספר `+972535648742`
2. תומר עונה בעברית ושואל "איך אפשר לעזור?"
3. תומר מזהה את הלקוח (`lookup-customer` מחזיר שם + חיות)
4. תומר מציג את שמות החיות בצורה טבעית
5. לאחר שיחה: רשומה ב-`voice_calls` עם `caller_phone`, `duration_seconds`
6. דשבורד → מסך "שיחות" מציג את השיחה

**קריטריון הצלחה:** שם הלקוח מוזכר בשיחה; רשומה בדשבורד.

---

## תרחיש 2 — שיחה נכנסת, לקוח חדש

1. חייג ממספר שאינו ב-DB
2. תומר אומר "לא מצאתי אותך במערכת" ואוסף: שם, שם חיה, סוג חיה
3. לאחר שיחה: רשומה ב-`voice_calls` עם `caller_phone`

**קריטריון הצלחה:** תומר ממשיך לסייע גם ללקוח חדש; לא קורס.

---

## תרחיש 3 — קביעת תור רגיל (checkup)

1. לקוח מבקש לקבוע תור לבדיקה (checkup) ביום בשבוע הבא
2. תומר קורא ל-`check-availability` ומציע שעה פנויה
3. לקוח מאשר
4. תומר קורא ל-`book-appointment`
5. רשומה חדשה ב-`appointments` עם `status = confirmed`
6. SMS נשלח ללקוח (בדוק `notifications_log`)
7. דשבורד → "היום" / "יומן" מציגים את התור

**קריטריון הצלחה:** תור ב-DB + SMS ב-log.

---

## תרחיש 4 — קביעת תור עיקור/סירוס (neutering → pending_approval)

1. לקוח מבקש תור לעיקור
2. תומר קורא ל-`book-appointment` עם `visit_type=neutering`
3. רשומה ב-`appointments` עם `status = pending_approval`
4. **אין** SMS לאחר קביעה (רק לאחר אישור נועה)
5. דשבורד → "היום" / ריבוע "ממתין לאישור" מופיע
6. נועה לוחצת "אשר" → `status = confirmed` + SMS נשלח

**קריטריון הצלחה:** pending_approval → confirmed → SMS.

---

## תרחיש 5 — ביטול תור (≥ 4 שעות לפני)

1. לקוח מבקש לבטל תור שנקבע ≥ 4 שעות מעכשיו
2. תומר קורא ל-`cancel-or-reschedule` עם `action=cancel`
3. `appointments.status = cancelled`
4. SMS ביטול נשלח ללקוח

**קריטריון הצלחה:** status=cancelled + SMS.

---

## תרחיש 6 — ביטול מאוחר (< 4 שעות — late_cancellation)

1. לקוח מבקש לבטל תור ביום שיחה, פחות מ-4 שעות לפני
2. תומר מציין שיחויב בדמי ביטול מלאים ומאשר את הבקשה
3. `appointments.status = late_cancellation`

**קריטריון הצלחה:** status=late_cancellation (לא cancelled).

---

## תרחיש 7 — טריאז' חירום (red flag)

1. לקוח מתאר תסמין חירום (כ-16 red flags בקובץ)  
   דוגמה: "הכלב שלי מאבד הכרה"
2. תומר מפעיל `triage-pet-case`
3. החלטה: `emergency_referral` → תומר אומר script חירום מילה במילה
4. escalation נכתב ב-`escalations` עם urgency ≥ 8
5. דשבורד → "אסקלציות" מציג את הפנייה

**קריטריון הצלחה:** script חירום מוקרא ללא שינוי; escalation ב-DB.

---

## תרחיש 8 — הצטרפות לרשימת המתנה (אין תורים)

1. לקוח מבקש תור בתאריך שאין בו זמינות
2. תומר מציע `join-waitlist`
3. לקוח מסכים
4. רשומה ב-`waitlist`
5. תומר מוסיף: "אם המצב מחמיר — פנה לבית חולים וטרינרי"

**קריטריון הצלחה:** רשומה ב-waitlist; אזהרת החמרה מוזכרת.

---

## תרחיש 9 — post-call: transcript + סיווג שיחה

1. לאחר שיחה שהסתיימה: ElevenLabs שולח POST ל-`/hooks/call-ended`
2. רשומה ב-`voice_calls` כוללת:
   - `transcript` — לא null
   - `ai_summary` — לא null
   - `call_category` — ערך תקין מתוך `VALID_CALL_CATEGORIES`
   - `duration_seconds` > 0
3. דשבורד → "שיחות" → לחיצה על שיחה → CallDrawer מציג את כל השדות

**קריטריון הצלחה:** כל 4 שדות מאוכלסים; DrawerAudio מפעיל הקלטה (אם הוקלטה).

---

## ⚠️ Known Issues לפני E2E

| בעיה | השפעה | פתרון |
|------|--------|--------|
| Fly.io trial — machine stops after 5 min | agent לא זמין | הוסף כרטיס אשראי |
| `APP_BASE_URL` לא מוגדר בזמן build | redirect URLs בסיסמת Supabase | כבר הוגדר post-deploy; ל-redeploy קצר יסגור |
| `/twilio/status` לא מאמת Twilio sig | Twilio יכול לקבל זבל | נמוך-סיכון; לתקן בספרינט 5 |

---

## אחרי E2E מוצלח

1. הגדר `SUPABASE_REDIRECT_URL` ב-Vercel לאחר קביעת דומיין סופי
2. הפעל pg_cron אחרי Fly billing מאושר  
3. בדוק `cron.job_run_details` אין שגיאות 24 שעות אחרי
