"use client";
import React from "react";
import Link from "next/link";
import { AnimalAvatar, PersonAvatar } from "@/components/dashboard/ui/avatar";
import { Badge } from "@/components/dashboard/ui/badge";
import { Drawer } from "@/components/dashboard/ui/drawer";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Customer } from "@/types/domain/customer";
import type { MedicalRecord } from "@/types/domain/medical-record";
import type { Pet } from "@/types/domain/pet";
import type { Prescription } from "@/types/domain/prescription";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Visit } from "@/types/domain/visit";

function initials(name: string): string {
  return name.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
}

export function PatientContextDrawer({
  open,
  onClose,
  pet,
  owner,
  visits,
  vaccinations,
  prescriptions,
  medicalRecord,
}: {
  open: boolean;
  onClose: () => void;
  pet: Pet;
  owner: Customer | null;
  visits: Visit[];
  vaccinations: Vaccination[];
  prescriptions: Prescription[];
  medicalRecord: MedicalRecord | null;
}) {
  const activePrescriptions = prescriptions.filter((prescription) => prescription.status === "active");
  const alerts = [
    pet.allergies ? `אלרגיה: ${pet.allergies}` : null,
    pet.chronicConditions ? `כרוני: ${pet.chronicConditions}` : null,
    ...(medicalRecord?.alerts ?? []).map((alert) => String(alert)),
  ].filter(Boolean);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={420}
      title={
        <div className="flex items-center gap-3">
          <AnimalAvatar species={pet.species} size={42} />
          <div>
            <p className="text-[15px] font-semibold text-[var(--ink)]">{pet.name}</p>
            <p className="text-xs font-normal text-[var(--muted)]">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
          </div>
        </div>
      }
    >
      <div className="space-y-6 px-5 py-4">
        {owner && (
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">בעלים</p>
            <Link
              href={`/dashboard/clients?customerId=${owner.id}`}
              className="flex items-center gap-3 rounded-[var(--r-md)] border border-[var(--line)] px-3 py-2 transition-colors hover:bg-[var(--surface-2)]"
            >
              <PersonAvatar initials={initials(owner.fullName)} size={34} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--ink)]">{owner.fullName}</p>
                <p className="truncate text-xs text-[var(--muted)]">{owner.phone ?? owner.email ?? "ללא פרטי קשר"}</p>
              </div>
            </Link>
          </section>
        )}

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">אזהרות</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {alerts.length === 0 ? (
              <span className="text-sm text-[var(--faint)]">אין אזהרות פעילות.</span>
            ) : (
              alerts.map((alert, index) => <Badge key={index} color="red">{alert}</Badge>)
            )}
          </div>
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">סיכום רפואי</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">
            {medicalRecord?.summary || "אין עדיין סיכום רפואי קבוע."}
          </p>
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">בעיות פעילות</p>
          <div className="mt-2 space-y-1">
            {(medicalRecord?.activeProblemList ?? []).length === 0 ? (
              <p className="text-sm text-[var(--faint)]">אין בעיות פעילות רשומות.</p>
            ) : (
              medicalRecord!.activeProblemList.map((problem, index) => (
                <p key={index} className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1 text-xs font-semibold text-[var(--ink)]">
                  {String(problem)}
                </p>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">ביקורים אחרונים</p>
            <Link href={`/dashboard/visits/new?petId=${pet.id}`} className="text-xs font-semibold text-[var(--brand-600)] hover:underline">
              ביקור חדש
            </Link>
          </div>
          {visits.length === 0 ? (
            <p className="text-sm text-[var(--faint)]">אין ביקורים רפואיים.</p>
          ) : (
            <div className="divide-y divide-[var(--line-2)] rounded-[var(--r-md)] border border-[var(--line)]">
              {visits.slice(0, 5).map((visit) => (
                <Link
                  key={visit.id}
                  href={`/dashboard/visits/${visit.id}`}
                  className="block px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <p className="text-[13px] font-semibold text-[var(--ink)]">{formatIsraelDateTime(visit.startedAt)}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{visit.chiefComplaint ?? "ללא תלונה ראשית"}</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">מניעה ותרופות</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--ink)]">
            <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] p-3">
              <p className="font-semibold">{vaccinations.length}</p>
              <p className="text-[var(--muted)]">חיסונים</p>
            </div>
            <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] p-3">
              <p className="font-semibold">{activePrescriptions.length}</p>
              <p className="text-[var(--muted)]">מרשמים פעילים</p>
            </div>
          </div>
        </section>
      </div>
    </Drawer>
  );
}
