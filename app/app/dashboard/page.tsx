"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { useToast } from "@/components/dashboard/ui/toast";
import {
  AttentionPanel,
  RecentActivityPanel,
  ScheduleList,
  TodayEmptyState,
  TodayMetrics,
  TodayPageHeading,
} from "./today-dashboard-sections";
import { buildTodayDashboardModel } from "./today-dashboard-model";
import { ISRAEL_TIMEZONE, israelDateIso, israelDayUtcRange } from "@/lib/israel-date";
import type { Appointment } from "@/types/domain/appointment";
import type { Escalation } from "@/types/domain/escalation";
import type { VoiceCall } from "@/types/domain/voice-call";
import type { WaitlistEntry } from "@/types/domain/waitlist";

type DashboardAppointment = Appointment & { phone?: string | null };

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ISRAEL_TIMEZONE }).format(new Date());
}

function ApproveRejectModal({
  mode,
  appointmentId,
  phone,
  customerName,
  petName,
  onConfirm,
  onClose,
}: {
  mode: "approve" | "reject";
  appointmentId: string;
  phone: string;
  customerName: string;
  petName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, customerName, petName }),
      });
      if (!res.ok) throw new Error();
      toast(mode === "approve" ? "התור אושר ונשלח SMS ללקוח" : "התור נדחה ונשלח SMS ללקוח", "success");
      onConfirm();
    } catch {
      toast("שגיאה בעדכון התור", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-[var(--r-xl)] bg-[var(--surface)] p-6 shadow-[var(--sh-lg)] modal-enter"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-[15px] font-bold text-[var(--ink)]">
          {mode === "approve" ? "אישור תור עיקור/סירוס" : "דחיית תור עיקור/סירוס"}
        </h3>
        <p className="mt-2 text-sm text-[var(--ink-2)]">
          {mode === "approve"
            ? `האם לאשר את תורו של ${petName}? לאחר האישור ישלח SMS ל-${customerName}.`
            : `האם לדחות את תורו של ${petName}? לאחר הדחייה ישלח SMS ביטול ל-${customerName}.`}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={onClose}>ביטול</Btn>
          <Btn
            variant={mode === "approve" ? "primary" : "danger"}
            size="sm"
            loading={loading}
            onClick={handleConfirm}
          >
            {mode === "approve" ? "אשר תור" : "דחה תור"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function TodayLoadingState() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-[84px]" />
        <Skeleton className="h-[84px]" />
        <Skeleton className="h-[84px]" />
        <Skeleton className="h-[84px]" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_408px]">
        <Skeleton className="h-[392px]" />
        <div className="space-y-5">
          <Skeleton className="h-[236px]" />
          <Skeleton className="h-[184px]" />
        </div>
      </div>
    </div>
  );
}

export default function TodayPage() {
  const [appointments, setAppointments] = useState<DashboardAppointment[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [todayCalls, setTodayCalls] = useState<VoiceCall[]>([]);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: "approve" | "reject"; appt: DashboardAppointment } | null>(null);

  const today = todayIso();

  const fetchData = useCallback(async () => {
    try {
      const callRange = israelDayUtcRange(today);
      const [apptRes, escRes, callRes, waitlistRes] = await Promise.all([
        fetch(`/api/appointments?date=${today}`),
        fetch("/api/escalations?status=open"),
        fetch(`/api/voice/calls?from=${encodeURIComponent(callRange.from)}&to=${encodeURIComponent(callRange.to)}`),
        fetch("/api/waitlist"),
      ]);

      if (apptRes.ok) {
        const d = await apptRes.json() as { data: { items: DashboardAppointment[] } };
        setAppointments((d.data.items ?? []).sort((a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        ));
      }
      if (escRes.ok) {
        const d = await escRes.json() as { data: { items: Escalation[] } };
        setEscalations(d.data.items ?? []);
      }
      if (callRes.ok) {
        const d = await callRes.json() as { data: { items: VoiceCall[] } };
        setTodayCalls(d.data.items ?? []);
      }
      if (waitlistRes.ok) {
        const d = await waitlistRes.json() as { data: { items: WaitlistEntry[] } };
        setWaitlistCount((d.data.items ?? []).length);
      }
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const model = buildTodayDashboardModel({
    today,
    appointments: appointments.filter((appointment) => israelDateIso(appointment.scheduledAt) === today),
    escalations,
    todayCalls,
    waitlistCount,
  });

  if (loading) return <TodayLoadingState />;

  return (
    <div className="space-y-5 p-6">
      <TodayPageHeading />
      <TodayMetrics metrics={model.metrics} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_408px]">
        <ScheduleList
          rows={model.scheduleRows}
          onApprove={(appt) => setModal({ mode: "approve", appt })}
          onReject={(appt) => setModal({ mode: "reject", appt })}
        />
        <div className="space-y-5">
          <AttentionPanel
            items={model.attentionItems}
            onApprove={(appt) => setModal({ mode: "approve", appt })}
            onReject={(appt) => setModal({ mode: "reject", appt })}
          />
          <RecentActivityPanel items={model.activityItems} />
        </div>
      </div>

      {model.scheduleRows.length === 0 && model.attentionItems.length === 0 && model.activityItems.length === 0 && (
        <TodayEmptyState />
      )}

      {modal && (
        <ApproveRejectModal
          mode={modal.mode}
          appointmentId={modal.appt.id}
          phone={modal.appt.phone ?? ""}
          customerName={modal.appt.customerName ?? ""}
          petName={modal.appt.petName ?? ""}
          onConfirm={() => {
            setModal(null);
            void fetchData();
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
