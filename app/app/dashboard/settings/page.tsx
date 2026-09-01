"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { useToast } from "@/components/dashboard/ui/toast";
import { LogoutButton } from "@/app/dashboard/logout-button";
import type { MeResponse } from "@/types/api/me";
import type { ClinicSettings } from "@/types/domain/clinic";
import { MAX_BUSINESS_HOURS_ROWS, MAX_VISIT_PRICE_ROWS } from "@/lib/validators/clinic-settings";

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  admin: "מנהל",
  veterinarian: "וטרינר/ית",
  staff: "צוות",
};

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

function SectionTitle({
  children,
  hint,
  action,
}: {
  children: React.ReactNode;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{children}</h2>
        {hint ? <p className="mt-0.5 text-xs text-[var(--faint)]">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

const inputClass =
  "w-full rounded-[var(--r-sm)] border border-[var(--line)] bg-white px-2.5 py-1.5 text-sm font-semibold text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]";

function EditRow({
  value,
  onChange,
  onRemove,
  canRemove,
  placeholders,
}: {
  value: { a: string; b: string };
  onChange: (next: { a: string; b: string }) => void;
  onRemove: () => void;
  canRemove: boolean;
  placeholders: [string, string];
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--line)] py-2 last:border-0">
      <input
        className={inputClass}
        value={value.a}
        placeholder={placeholders[0]}
        onChange={(e) => onChange({ ...value, a: e.target.value })}
      />
      <input
        className={inputClass}
        value={value.b}
        placeholder={placeholders[1]}
        onChange={(e) => onChange({ ...value, b: e.target.value })}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        title={canRemove ? undefined : "חייבת להישאר לפחות שורה אחת"}
        className="flex-shrink-0 text-xs font-semibold text-[var(--red-600)] hover:underline disabled:opacity-40 disabled:no-underline"
      >
        הסר
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [draft, setDraft] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsLoadFailed, setSettingsLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      try {
        const [meRes, settingsRes] = await Promise.all([
          fetch("/api/me"),
          fetch("/api/settings"),
        ]);
        if (!ignore && meRes.ok) {
          const payload = (await meRes.json()) as { data: MeResponse };
          setMe(payload.data);
        }
        if (!ignore) {
          if (settingsRes.ok) {
            const payload = (await settingsRes.json()) as { data: ClinicSettings };
            setSettings(payload.data);
          } else {
            setSettingsLoadFailed(true);
            toast("טעינת הגדרות המרפאה נכשלה — נסה/י לרענן את הדף", "error");
          }
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const membership = me?.memberships.find((m) => m.clinicId === me.profile.defaultClinicId)
    ?? me?.memberships[0];
  const canEdit = membership?.role === "owner" || membership?.role === "admin";

  function startEditing() {
    if (!settings) return;
    setDraft(structuredClone(settings));
    setEditing(true);
  }

  function cancelEditing() {
    setDraft(null);
    setEditing(false);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast(body?.error?.message ?? "שמירת ההגדרות נכשלה", "error");
        return;
      }
      const payload = (await res.json()) as { data: ClinicSettings };
      setSettings(payload.data);
      setDraft(null);
      setEditing(false);
      toast("ההגדרות נשמרו", "success");
    } finally {
      setSaving(false);
    }
  }

  const editAction = canEdit && settings ? (
    editing ? (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={cancelEditing}
          disabled={saving}
          className="rounded-[var(--r-sm)] border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-[var(--r-sm)] bg-[var(--brand-600)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "שומר..." : "שמור"}
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={startEditing}
        className="rounded-[var(--r-sm)] border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
      >
        ערוך
      </button>
    )
  ) : null;

  return (
    <div className="min-h-full bg-[var(--bg)] p-6">
      <div className="mx-auto max-w-[880px] space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-[var(--ink)]">הגדרות</h1>
            <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
              סקירת התצורה של המרפאה והחשבון שלך
            </p>
          </div>
          {!loading ? editAction : null}
        </div>

        {settingsLoadFailed ? (
          <div className="rounded-[var(--r-md)] border border-[var(--red-100)] bg-[var(--red-50)] px-4 py-3 text-sm font-semibold text-[var(--red-700)]">
            טעינת הגדרות המרפאה נכשלה. רענן/י את הדף כדי לנסות שוב.
          </div>
        ) : null}

        {/* Clinic profile */}
        <Card>
          <SectionTitle>פרטי המרפאה</SectionTitle>
          {loading ? (
            <Skeleton className="h-24" />
          ) : editing && draft ? (
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="text-[var(--muted)]">שם</span>
                <span className="font-semibold text-[var(--ink)]">{membership?.clinicName ?? "Get A Vet"}</span>
              </label>
              <label className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="flex-shrink-0 text-[var(--muted)]">כתובת</span>
                <input
                  className={inputClass}
                  value={draft.contact.address}
                  onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, address: e.target.value } })}
                />
              </label>
              <label className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="flex-shrink-0 text-[var(--muted)]">וואטסאפ</span>
                <input
                  dir="ltr"
                  className={inputClass}
                  value={draft.contact.whatsapp}
                  onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, whatsapp: e.target.value } })}
                />
              </label>
              <label className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className="flex-shrink-0 text-[var(--muted)]">אימייל</span>
                <input
                  dir="ltr"
                  className={inputClass}
                  value={draft.contact.email}
                  onChange={(e) => setDraft({ ...draft, contact: { ...draft.contact, email: e.target.value } })}
                />
              </label>
              <Row label="אזור זמן" value="ישראל (Asia/Jerusalem)" />
            </div>
          ) : (
            <div>
              <Row label="שם" value={membership?.clinicName ?? "Get A Vet"} />
              <Row label="כתובת" value={settings?.contact.address ?? "—"} />
              <Row label="וואטסאפ" value={<span dir="ltr">{settings?.contact.whatsapp ?? "—"}</span>} />
              <Row label="אימייל" value={settings?.contact.email ?? "—"} />
              <Row label="אזור זמן" value="ישראל (Asia/Jerusalem)" />
            </div>
          )}
        </Card>

        {/* Business hours */}
        <Card>
          <SectionTitle hint="תומר מציע תורים רק בשעות אלה">שעות פעילות</SectionTitle>
          {loading ? (
            <Skeleton className="h-20" />
          ) : editing && draft ? (
            <div>
              {draft.businessHours.map((b, i) => (
                <EditRow
                  key={i}
                  value={{ a: b.day, b: b.hours }}
                  placeholders={["יום", "שעות"]}
                  canRemove={draft.businessHours.length > 1}
                  onChange={(next) =>
                    setDraft({
                      ...draft,
                      businessHours: draft.businessHours.map((row, idx) =>
                        idx === i ? { day: next.a, hours: next.b } : row,
                      ),
                    })
                  }
                  onRemove={() =>
                    setDraft({
                      ...draft,
                      businessHours: draft.businessHours.filter((_, idx) => idx !== i),
                    })
                  }
                />
              ))}
              <button
                type="button"
                disabled={draft.businessHours.length >= MAX_BUSINESS_HOURS_ROWS}
                onClick={() =>
                  setDraft({ ...draft, businessHours: [...draft.businessHours, { day: "", hours: "" }] })
                }
                className="mt-2 text-xs font-semibold text-[var(--brand-600)] hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {draft.businessHours.length >= MAX_BUSINESS_HOURS_ROWS
                  ? `הגעת למספר השורות המרבי (${MAX_BUSINESS_HOURS_ROWS})`
                  : "+ הוסף שורה"}
              </button>
            </div>
          ) : (
            <div>
              {(settings?.businessHours ?? []).map((b) => (
                <Row key={b.day} label={b.day} value={<span dir="ltr">{b.hours}</span>} />
              ))}
            </div>
          )}
        </Card>

        {/* Visit types */}
        <Card>
          <SectionTitle>סוגי ביקורים ומחירים</SectionTitle>
          {loading ? (
            <Skeleton className="h-32" />
          ) : editing && draft ? (
            <div>
              {draft.visitPrices.map((v, i) => (
                <EditRow
                  key={i}
                  value={{ a: v.label, b: v.detail }}
                  placeholders={["סוג ביקור", "מחיר / פרטים"]}
                  canRemove={draft.visitPrices.length > 1}
                  onChange={(next) =>
                    setDraft({
                      ...draft,
                      visitPrices: draft.visitPrices.map((row, idx) =>
                        idx === i ? { label: next.a, detail: next.b } : row,
                      ),
                    })
                  }
                  onRemove={() =>
                    setDraft({
                      ...draft,
                      visitPrices: draft.visitPrices.filter((_, idx) => idx !== i),
                    })
                  }
                />
              ))}
              <button
                type="button"
                disabled={draft.visitPrices.length >= MAX_VISIT_PRICE_ROWS}
                onClick={() =>
                  setDraft({ ...draft, visitPrices: [...draft.visitPrices, { label: "", detail: "" }] })
                }
                className="mt-2 text-xs font-semibold text-[var(--brand-600)] hover:underline disabled:opacity-40 disabled:no-underline"
              >
                {draft.visitPrices.length >= MAX_VISIT_PRICE_ROWS
                  ? `הגעת למספר השורות המרבי (${MAX_VISIT_PRICE_ROWS})`
                  : "+ הוסף שורה"}
              </button>
            </div>
          ) : (
            <div>
              {(settings?.visitPrices ?? []).map((v) => (
                <Row key={v.label} label={v.label} value={v.detail} />
              ))}
            </div>
          )}
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
