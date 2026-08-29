"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { InvoicesSection } from "@/components/dashboard/invoices-section";
import { PetProfileForm } from "@/app/dashboard/pets/[petId]/pet-profile-form";
import { formatIsraelDate, formatIsraelDateTime } from "@/lib/israel-date";
import type { Pet } from "@/types/domain/pet";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Prescription } from "@/types/domain/prescription";
import type { Visit, VisitStatus } from "@/types/domain/visit";

const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  in_progress: "בטיפול",
  completed: "הושלם",
  cancelled: "בוטל",
};

const PRESCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  discontinued: "הופסק",
};

type Tab = "overview" | "visits" | "vaccinations" | "medications" | "billing";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "סקירה" },
  { id: "visits", label: "ביקורים" },
  { id: "vaccinations", label: "חיסונים" },
  { id: "medications", label: "תרופות" },
  { id: "billing", label: "חיובים" },
];

export function PetDetailTabs({
  pet,
  clinicId,
  visits,
  vaccinations,
  prescriptions,
}: {
  pet: Pet;
  clinicId: string;
  visits: Visit[];
  vaccinations: Vaccination[];
  prescriptions: Prescription[];
}) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--line)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "border-b-2 px-4 py-3 text-sm font-semibold transition-colors",
              tab === t.id
                ? "border-[var(--brand-600)] text-[var(--brand-600)]"
                : "border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-5">
        {tab === "overview" && (
          <div className="space-y-5">
            <Card>
              <PetProfileForm pet={pet} />
            </Card>
          </div>
        )}

        {tab === "visits" && (
          <Card noPad>
            <div className="flex items-center justify-between px-5 pb-3 pt-5">
              <h3 className="text-[15px] font-bold text-[var(--ink)]">ביקורים</h3>
              <Link href={`/dashboard/visits/new?petId=${pet.id}`} className="text-[13px] font-semibold text-[var(--brand-600)] hover:underline">
                + ביקור חדש
              </Link>
            </div>
            {visits.length === 0 ? (
              <EmptyState title="לא נרשמו ביקורים" className="pb-6" />
            ) : (
              <div className="divide-y divide-[var(--line-2)] px-2 pb-2">
                {visits.map((visit) => (
                  <Link
                    key={visit.id}
                    href={`/dashboard/visits/${visit.id}`}
                    className="flex items-center justify-between gap-2 rounded-[var(--r-md)] px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--ink)]">{formatIsraelDateTime(visit.startedAt)}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{visit.chiefComplaint ?? "ללא תלונה ראשית"}</p>
                    </div>
                    <Badge color={visit.status === "completed" ? "green" : visit.status === "cancelled" ? "muted" : "brand"}>
                      {VISIT_STATUS_LABELS[visit.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "vaccinations" && (
          <Card noPad>
            <h3 className="px-5 pb-3 pt-5 text-[15px] font-bold text-[var(--ink)]">חיסונים</h3>
            {vaccinations.length === 0 ? (
              <EmptyState title="לא נרשמו חיסונים" className="pb-6" />
            ) : (
              <div className="divide-y divide-[var(--line-2)] px-5 pb-5">
                {vaccinations.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--ink)]">{v.vaccineName}</p>
                      <p className="text-xs text-[var(--muted)]">{formatIsraelDate(v.administeredAt)}</p>
                    </div>
                    {v.nextDueAt && (
                      <Badge color={new Date(v.nextDueAt) < new Date() ? "red" : "green"}>
                        {new Date(v.nextDueAt) < new Date() ? "פג תוקף" : "בתוקף"} · {formatIsraelDate(v.nextDueAt)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "medications" && (
          <Card noPad>
            <h3 className="px-5 pb-3 pt-5 text-[15px] font-bold text-[var(--ink)]">תרופות ומרשמים</h3>
            {prescriptions.length === 0 ? (
              <EmptyState title="אין מרשמים רשומים" className="pb-6" />
            ) : (
              <div className="divide-y divide-[var(--line-2)] px-5 pb-5">
                {prescriptions.map((rx) => (
                  <div key={rx.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[var(--ink)]">{rx.medicationName}</p>
                      <Badge color={rx.status === "active" ? "green" : "muted"}>
                        {PRESCRIPTION_STATUS_LABELS[rx.status] ?? rx.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-[var(--muted)]">{rx.instructions}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "billing" && (
          <Card>
            <InvoicesSection clinicId={clinicId} customerId={pet.customerId} petId={pet.id} />
          </Card>
        )}
      </div>
    </div>
  );
}
