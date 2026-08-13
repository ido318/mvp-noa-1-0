"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { LogoutButton } from "@/app/dashboard/logout-button";
import type { MeResponse } from "@/types/api/me";

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  admin: "מנהל",
  veterinarian: "וטרינר/ית",
  staff: "צוות",
};

const BUSINESS_HOURS: Array<{ day: string; hours: string }> = [
  { day: "ראשון–חמישי", hours: "08:00–20:00" },
  { day: "שישי", hours: "08:30–13:00" },
  { day: "שבת", hours: "סגור" },
];

const VISIT_TYPES: Array<{ label: string; detail: string }> = [
  { label: "בדיקה בקליניקה", detail: "150 ₪ · 30 דק׳" },
  { label: "ביקור בית", detail: "300 ₪ · 60 דק׳ (אזורי שירות)" },
  { label: "חיסונים", detail: "150 ₪ אגרה + עלות החיסון" },
  { label: "ייעוץ טלפוני", detail: "200 ₪ · 20 דק׳" },
  { label: "עיקור/סירוס", detail: "ממתין לאישור נועה" },
];

const CLIENT_SMS: Array<{ label: string; when: string }> = [
  { label: "אישור קביעת תור", when: "מיד עם הקביעה" },
  { label: "תזכורת בוקר", when: "08:00 ביום התור" },
  { label: "אישור הגעה", when: "שעתיים לפני התור" },
  { label: "מעקב אחרי ביקור", when: "יממה לאחר הביקור" },
  { label: "עדכון ביטול/שינוי", when: "כשנועה משנה תור" },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-2.5 last:border-0">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--ink)]">{value}</span>
    </div>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{children}</h2>
      {hint ? <p className="mt-0.5 text-xs text-[var(--faint)]">{hint}</p> : null}
    </div>
  );
}

export default function SettingsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const payload = (await res.json()) as { data: MeResponse };
          if (!ignore) setMe(payload.data);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const membership = me?.memberships.find((m) => m.clinicId === me.profile.defaultClinicId)
    ?? me?.memberships[0];

  return (
    <div className="min-h-full bg-[var(--bg)] p-6">
      <div className="mx-auto max-w-[880px] space-y-5">
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight text-[var(--ink)]">הגדרות</h1>
          <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
            סקירת התצורה של המרפאה והחשבון שלך
          </p>
        </div>

        {/* Clinic profile */}
        <Card>
          <SectionTitle>פרטי המרפאה</SectionTitle>
          {loading ? (
            <Skeleton className="h-24" />
          ) : (
            <div>
              <Row label="שם" value={membership?.clinicName ?? "Get A Vet"} />
              <Row label="כתובת" value="יצחק (זיקו) גרציאני 6, תל אביב-יפו" />
              <Row label="וואטסאפ" value={<span dir="ltr">+972 54-958-1991</span>} />
              <Row label="אימייל" value="contact@getavett.com" />
              <Row label="אזור זמן" value="ישראל (Asia/Jerusalem)" />
            </div>
          )}
        </Card>

        {/* Business hours */}
        <Card>
          <SectionTitle hint="תומר מציע תורים רק בשעות אלה">שעות פעילות</SectionTitle>
          <div>
            {BUSINESS_HOURS.map((b) => (
              <Row key={b.day} label={b.day} value={<span dir="ltr">{b.hours}</span>} />
            ))}
          </div>
        </Card>

        {/* Visit types */}
        <Card>
          <SectionTitle>סוגי ביקורים ומחירים</SectionTitle>
          <div>
            {VISIT_TYPES.map((v) => (
              <Row key={v.label} label={v.label} value={v.detail} />
            ))}
          </div>
        </Card>

        {/* Client SMS */}
        <Card>
          <SectionTitle hint="הודעות שנשלחות אוטומטית ללקוחות">התראות SMS ללקוחות</SectionTitle>
          <div>
            {CLIENT_SMS.map((s) => (
              <Row key={s.label} label={s.label} value={s.when} />
            ))}
          </div>
        </Card>

        {/* Tomer agent */}
        <Card>
          <SectionTitle hint="מנוהל בתצורת הסוכן (ElevenLabs)">תומר — הסוכן הקולי</SectionTitle>
          <div>
            <Row label="מספר נכנס" value={<span dir="ltr">+972 53-564-8742</span>} />
            <Row label="שפה" value="עברית" />
            <Row
              label="ניתוב תורים"
              value={<Badge color="green">בזמן אמת ליומן</Badge>}
            />
            <Row
              label="העברה לנציג אנושי"
              value="בשעות פעילות (אחרת — הסלמה)"
            />
          </div>
        </Card>

        {/* Account */}
        <Card>
          <SectionTitle>החשבון שלי</SectionTitle>
          {loading ? (
            <Skeleton className="h-16" />
          ) : (
            <div className="space-y-3">
              <Row label="שם" value={me?.profile.fullName ?? "—"} />
              <Row label="אימייל" value={<span dir="ltr">{me?.user.email ?? "—"}</span>} />
              <Row
                label="הרשאה"
                value={membership ? (ROLE_LABELS[membership.role] ?? membership.role) : "—"}
              />
              <div className="flex justify-end pt-1">
                <LogoutButton />
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
