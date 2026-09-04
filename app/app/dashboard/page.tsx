"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Btn } from "@/components/dashboard/ui/btn";
import { ApproveRejectModal } from "@/components/dashboard/approve-reject-modal";
import {
  AttentionPanel,
  CareFlowPanel,
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

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ISRAEL_TIMEZONE }).format(new Date());
}

function TodayLoadingState() {
  return (
    <div className="mx-auto w-full max-w-[1184px] space-y-5 p-6">
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [todayCalls, setTodayCalls] = useState<VoiceCall[]>([]);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [modal, setModal] = useState<{ mode: "approve" | "reject"; appt: Appointment } | null>(null);

  const today = todayIso();

  const fetchData = useCallback(async () => {
    setLoadError(false);
    try {
      const callRange = israelDayUtcRange(today);
      const [apptRes, escRes, callRes, waitlistRes] = await Promise.all([
        fetch(`/api/appointments?date=${today}`),
        fetch("/api/escalations?status=open"),
        fetch(`/api/voice/calls?from=${encodeURIComponent(callRange.from)}&to=${encodeURIComponent(callRange.to)}`),
        fetch("/api/waitlist"),
      ]);

      // Any failed request means the dashboard is showing incomplete data —
      // surface that instead of silently rendering "no activity today",
      // which pending/failed requests would otherwise look identical to.
      if (!apptRes.ok || !escRes.ok || !callRes.ok || !waitlistRes.ok) {
        setLoadError(true);
      }

      if (apptRes.ok) {
        const d = await apptRes.json() as { data: { items: Appointment[] } };
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
    } catch {
      // Network failure (offline, DNS, etc.) — same "incomplete data" story
      // as a non-ok response, just before any response existed to check.
      setLoadError(true);
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
    <div className="mx-auto w-full max-w-[1184px] space-y-5 p-6">
      <TodayPageHeading />
      <TodayMetrics metrics={model.metrics} />
      <CareFlowPanel checkedInRows={model.checkedInRows} inVisitRows={model.inVisitRows} />

      <div className="grid gap-5 xl:grid-cols-[408px_minmax(0,1fr)]">
        <div className="space-y-5">
          <AttentionPanel
            items={model.attentionItems}
            onApprove={(appt) => setModal({ mode: "approve", appt })}
            onReject={(appt) => setModal({ mode: "reject", appt })}
          />
          <RecentActivityPanel items={model.activityItems} />
        </div>
        <ScheduleList
          rows={model.scheduleRows}
          onApprove={(appt) => setModal({ mode: "approve", appt })}
          onReject={(appt) => setModal({ mode: "reject", appt })}
        />
      </div>

      {loadError && (
        <EmptyState
          title="טעינת נתוני היום נכשלה"
          subtitle="ייתכן שהמידע המוצג חלקי. נסה לרענן."
          action={
            <Btn type="button" size="sm" variant="soft" onClick={() => void fetchData()}>
              נסה שוב
            </Btn>
          }
        />
      )}

      {!loadError && model.scheduleRows.length === 0 && model.attentionItems.length === 0 && model.activityItems.length === 0 && (
        <TodayEmptyState />
      )}

      {modal && (
        <ApproveRejectModal
          mode={modal.mode}
          appointmentId={modal.appt.id}
          phone={modal.appt.customerPhone ?? ""}
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
