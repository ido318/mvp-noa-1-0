"use client";
import React from "react";
import Link from "next/link";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { Card } from "@/components/dashboard/ui/card";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { TypePill } from "@/components/dashboard/ui/type-pill";
import { UrgencyMeter } from "@/components/dashboard/ui/urgency-meter";
import {
  CheckIcon,
  ClockIcon,
  PhoneIcon,
  PlusIcon,
  SparkleIcon,
  UserIcon,
  XIcon,
} from "@/components/dashboard/icons";
import type { Appointment } from "@/types/domain/appointment";
import type {
  TodayActivityItem,
  TodayAttentionItem,
  TodayMetric,
  TodayScheduleRow,
} from "./today-dashboard-model";

const metricToneClasses: Record<TodayMetric["tone"], { bar: string; value: string }> = {
  brand: { bar: "bg-[var(--brand-600)]", value: "text-[var(--brand-600)]" },
  amber: { bar: "bg-[var(--amber-600)]", value: "text-[var(--amber-600)]" },
  coral: { bar: "bg-[var(--coral-600)]", value: "text-[var(--coral-600)]" },
  red: { bar: "bg-[var(--red-600)]", value: "text-[var(--red-600)]" },
};

export function TodayPageHeading() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-[28px] font-extrabold leading-tight text-[var(--ink)]">היום במרפאה</h1>
      <Link
        href="/dashboard/appointments/new"
        className="inline-flex h-9 items-center justify-center gap-2 rounded-[11px] bg-[var(--brand-600)] px-4 text-sm font-semibold text-white shadow-[var(--sh-md)] transition-all duration-150 hover:brightness-110 active:brightness-95"
      >
        <PlusIcon size={16} />
        יצירה מהירה
      </Link>
    </div>
  );
}

export function TodayMetrics({ metrics }: { metrics: TodayMetric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const tone = metricToneClasses[metric.tone];
        return (
          <Card key={metric.label} className="relative min-h-[84px] overflow-hidden p-4">
            <span className={["absolute end-4 top-5 h-10 w-1 rounded-full", tone.bar].join(" ")} />
            <p className="text-[13px] font-semibold text-[var(--ink-2)]">{metric.label}</p>
            <p className={["mt-2 text-[30px] font-extrabold leading-none tabular-nums", tone.value].join(" ")}>
              {metric.value}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

export function ScheduleList({
  rows,
  onApprove,
  onReject,
}: {
  rows: TodayScheduleRow[];
  onApprove: (appointment: Appointment) => void;
  onReject: (appointment: Appointment) => void;
}) {
  return (
    <Card noPad className="overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4">
        <h2 className="text-[17px] font-extrabold text-[var(--ink)]">סדר יום תורים</h2>
        <Link href="/dashboard/calendar" className="text-[13px] font-semibold text-[var(--brand-600)] hover:underline">
          לוח שנה מלא ←
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClockIcon size={28} />}
          title="אין תורים להיום"
          subtitle="כשיהיו תורים להיום הם יופיעו כאן"
          className="py-12"
        />
      ) : (
        <div className="space-y-3 px-5 pb-5">
          {rows.map((row) => {
            const isPending = row.status === "pending_approval";
            return (
              <div
                key={row.id}
                className="grid min-h-[56px] grid-cols-[64px_40px_minmax(0,1fr)] items-center gap-3 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 lg:grid-cols-[64px_40px_minmax(0,1fr)_auto]"
              >
                <div className="text-[16px] font-extrabold tabular-nums text-[var(--ink)]">{row.time}</div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--line-2)] text-[13px] font-bold text-[var(--ink-2)]">
                  {row.petName.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[14px] font-bold text-[var(--ink)]">{row.petName}</p>
                    <TypePill type={row.appointmentType} />
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--muted)]">
                    {row.reason} · {row.customerName}
                  </p>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-2 lg:col-span-1">
                  <Badge color={isPending ? "amber" : "muted"}>
                    {isPending ? "ממתין" : row.status === "completed" ? "הושלם" : "מתוכנן"}
                  </Badge>
                  {isPending && (
                    <div className="flex gap-1">
                      <Btn size="sm" variant="soft" onClick={() => onApprove(row.appointment)}>
                        <CheckIcon size={12} />
                        אשר
                      </Btn>
                      <Btn size="sm" variant="dangerSoft" onClick={() => onReject(row.appointment)}>
                        <XIcon size={12} />
                        דחה
                      </Btn>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function AttentionPanel({
  items,
  onApprove,
  onReject,
}: {
  items: TodayAttentionItem[];
  onApprove: (appointment: Appointment) => void;
  onReject: (appointment: Appointment) => void;
}) {
  return (
    <Card noPad className="overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4">
        <SparkleIcon size={16} className="text-[var(--red-600)]" />
        <h2 className="text-[16px] font-extrabold text-[var(--ink)]">דורש תשומת לב</h2>
      </div>
      {items.length === 0 ? (
        <EmptyState title="אין נושאים דחופים" subtitle="המרפאה נקייה מפריטים לטיפול מיידי" className="py-10" />
      ) : (
        <div className="space-y-3 px-5 pb-5">
          {items.map((item) => (
            <div key={item.id} className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[var(--ink)]">{item.title}</p>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">{item.subtitle}</p>
                </div>
                <Badge color={item.tone}>{item.kind === "pending_approval" ? "היום" : "דחוף"}</Badge>
              </div>
              {item.urgency != null && <UrgencyMeter value={item.urgency} className="mt-3" />}
              {item.appointment && (
                <div className="mt-3 flex gap-1.5">
                  <Btn size="sm" variant="soft" onClick={() => onApprove(item.appointment!)}>
                    <CheckIcon size={12} />
                    אשר
                  </Btn>
                  <Btn size="sm" variant="dangerSoft" onClick={() => onReject(item.appointment!)}>
                    <XIcon size={12} />
                    דחה
                  </Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function RecentActivityPanel({ items }: { items: TodayActivityItem[] }) {
  return (
    <Card noPad className="overflow-hidden">
      <div className="px-5 py-4">
        <h2 className="text-[16px] font-extrabold text-[var(--ink)]">פעילות אחרונה</h2>
      </div>
      {items.length === 0 ? (
        <EmptyState title="אין פעילות אחרונה" subtitle="שיחות ועדכונים מהיום יופיעו כאן" className="py-10" />
      ) : (
        <div className="space-y-4 px-5 pb-5">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-[var(--brand-600)]" />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[var(--ink)]">{item.title}</p>
                <p className="truncate text-[12px] text-[var(--ink-2)]">{item.subtitle}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TodayEmptyState() {
  return (
    <EmptyState
      icon={<UserIcon size={32} />}
      title="אין פעילות להיום"
      subtitle="כשיהיו תורים, שיחות או פריטים לטיפול הם יופיעו כאן"
    />
  );
}

export function CallShortcut() {
  return (
    <Link
      href="/dashboard/calls"
      className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--brand-600)] hover:underline"
    >
      <PhoneIcon size={14} />
      כל השיחות
    </Link>
  );
}
