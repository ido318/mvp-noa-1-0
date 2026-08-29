"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/dashboard/ui/modal";
import { Btn } from "@/components/dashboard/ui/btn";
import { AnimalIcon } from "@/components/dashboard/icons";
import { useToast } from "@/components/dashboard/ui/toast";
import { VISIT_TYPE_CONFIG, effectiveDuration, getBookableDates } from "@/lib/appointment-rules";
import { formatIsraelDate, formatIsraelTime } from "@/lib/israel-date";
import type { AppointmentType } from "@/types/domain/appointment";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";

type Step = 1 | 2 | 3 | 4 | 5;

const VISIT_TYPES = Object.keys(VISIT_TYPE_CONFIG) as AppointmentType[];

export function NewAppointmentWizard({
  open,
  onClose,
  clinicId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  clinicId: string;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [pet, setPet] = useState<Pet | null>(null);
  const [visitType, setVisitType] = useState<AppointmentType>("checkup");
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const bookableDates = useMemo(() => getBookableDates(new Date().toISOString().slice(0, 10)), []);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setCustomerQuery("");
      setCustomerResults([]);
      setCustomer(null);
      setPets([]);
      setPet(null);
      setVisitType("checkup");
      setDate(null);
      setSlots([]);
      setSlot(null);
      setReason("");
    }
  }, [open]);

  useEffect(() => {
    const trimmed = customerQuery.trim();
    if (trimmed.length < 2) { setCustomerResults([]); return; }
    const t = setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/search?entity=customers&q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data = await res.json() as { data: { customers: Customer[] } };
        setCustomerResults(data.data.customers);
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [customerQuery]);

  useEffect(() => {
    if (!customer) { setPets([]); return; }
    void (async () => {
      const res = await fetch(`/api/customers/${customer.id}/pets`);
      if (!res.ok) return;
      const data = await res.json() as { data: { items: Pet[] } };
      setPets(data.data.items);
    })();
  }, [customer]);

  useEffect(() => {
    if (!date) { setSlots([]); return; }
    setSlot(null);
    void (async () => {
      const res = await fetch(
        `/api/calendar/availability?clinicId=${encodeURIComponent(clinicId)}&date=${encodeURIComponent(date)}&visitType=${encodeURIComponent(visitType)}`,
      );
      if (!res.ok) { setSlots([]); return; }
      const data = await res.json() as { data: { availableSlots: string[] } };
      setSlots(data.data.availableSlots);
    })();
  }, [date, visitType, clinicId]);

  async function submit() {
    if (!customer || !pet || !slot) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId,
          customerId: customer.id,
          petId: pet.id,
          appointmentType: visitType,
          source: "front_desk",
          scheduledAt: slot,
          durationMinutes: effectiveDuration(visitType),
          reason: reason.trim() || null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "קביעת התור נכשלה");
      }
      toast("התור נקבע בהצלחה", "success");
      onCreated();
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "קביעת התור נכשלה", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const STEP_TITLES: Record<Step, string> = {
    1: "בחירת לקוח",
    2: "בחירת מטופל",
    3: "סוג תור",
    4: "מועד ותאריך",
    5: "אישור",
  };

  const canAdvance =
    (step === 1 && customer != null) ||
    (step === 2 && pet != null) ||
    (step === 3 && visitType != null) ||
    (step === 4 && slot != null) ||
    step === 5;

  return (
    <Modal open={open} onClose={onClose} title="תור חדש" subtitle={`שלב ${step} מתוך 5 · ${STEP_TITLES[step]}`} maxWidth={480}>
      <div className="space-y-4">
        {step === 1 && (
          <div className="space-y-2">
            <input
              autoFocus
              type="search"
              placeholder="חיפוש לפי שם או טלפון..."
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              className="h-10 w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm outline-none focus:border-[var(--brand-400)]"
            />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {customerResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCustomer(c)}
                  className={[
                    "flex w-full items-center justify-between rounded-[var(--r-md)] border px-3 py-2 text-start text-sm transition-colors",
                    customer?.id === c.id
                      ? "border-[var(--brand-400)] bg-[var(--brand-50)]"
                      : "border-[var(--line)] hover:bg-[var(--surface-2)]",
                  ].join(" ")}
                >
                  <span className="font-semibold text-[var(--ink)]">{c.fullName}</span>
                  <span className="text-[var(--muted)]">{c.phone ?? c.email ?? ""}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-1">
            {pets.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">ללקוח זה אין מטופלים רשומים.</p>
            ) : pets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPet(p)}
                className={[
                  "flex w-full items-center gap-3 rounded-[var(--r-md)] border px-3 py-2.5 text-start text-sm transition-colors",
                  pet?.id === p.id
                    ? "border-[var(--brand-400)] bg-[var(--brand-50)]"
                    : "border-[var(--line)] hover:bg-[var(--surface-2)]",
                ].join(" ")}
              >
                <AnimalIcon species={p.species} size={20} />
                <span className="font-semibold text-[var(--ink)]">{p.name}</span>
                <span className="text-[var(--muted)]">{p.breed ?? p.species}</span>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-2 gap-2">
            {VISIT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setVisitType(type)}
                className={[
                  "rounded-[var(--r-md)] border px-3 py-2.5 text-start text-sm transition-colors",
                  visitType === type
                    ? "border-[var(--brand-400)] bg-[var(--brand-50)]"
                    : "border-[var(--line)] hover:bg-[var(--surface-2)]",
                ].join(" ")}
              >
                <p className="font-semibold text-[var(--ink)]">{VISIT_TYPE_CONFIG[type].labelHe}</p>
                <p className="text-[var(--muted)]">{VISIT_TYPE_CONFIG[type].durationMin} דק&apos;</p>
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {bookableDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDate(d)}
                  className={[
                    "rounded-[var(--r-md)] border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    date === d
                      ? "border-[var(--brand-400)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]",
                  ].join(" ")}
                >
                  {formatIsraelDate(d)}
                </button>
              ))}
            </div>
            {date && (
              <div className="flex flex-wrap gap-1.5">
                {slots.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">אין תורים פנויים בתאריך זה.</p>
                ) : slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={[
                      "rounded-[var(--r-md)] border px-3 py-1.5 text-sm font-semibold transition-colors",
                      slot === s
                        ? "border-[var(--brand-400)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    {formatIsraelTime(s)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 5 && customer && pet && slot && (
          <div className="space-y-3">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--muted)]">לקוח</dt><dd className="font-semibold text-[var(--ink)]">{customer.fullName}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">מטופל</dt><dd className="font-semibold text-[var(--ink)]">{pet.name}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">סוג תור</dt><dd className="font-semibold text-[var(--ink)]">{VISIT_TYPE_CONFIG[visitType].labelHe}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">מועד</dt><dd className="font-semibold text-[var(--ink)]">{formatIsraelDate(slot)} {formatIsraelTime(slot)}</dd></div>
            </dl>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="סיבת הביקור (אופציונלי)"
              rows={2}
              className="w-full rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:border-[var(--brand-400)]"
            />
          </div>
        )}

        <div className="flex justify-between border-t border-[var(--line-2)] pt-4">
          <Btn variant="ghost" size="sm" onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as Step))}>
            {step === 1 ? "ביטול" : "חזרה"}
          </Btn>
          {step === 5 ? (
            <Btn size="sm" loading={submitting} onClick={submit}>קביעת תור</Btn>
          ) : (
            <Btn size="sm" disabled={!canAdvance} onClick={() => setStep((s) => (s + 1) as Step)}>הבא</Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}
