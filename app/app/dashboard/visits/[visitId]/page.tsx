import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { VisitActions } from "@/app/dashboard/visits/visit-actions";
import { VisitAiSummarySection } from "@/app/dashboard/visits/visit-ai-summary-section";
import { VisitNotesSection } from "@/app/dashboard/visits/visit-notes-section";
import { VisitPrescriptionsSection } from "@/app/dashboard/visits/visit-prescriptions-section";
import { VisitShareSection } from "@/app/dashboard/visits/visit-share-section";
import { VisitVaccinationsSection } from "@/app/dashboard/visits/visit-vaccinations-section";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Customer } from "@/types/domain/customer";
import type { MedicalNote } from "@/types/domain/medical-note";
import type { Pet } from "@/types/domain/pet";
import type { Prescription } from "@/types/domain/prescription";
import type { Vaccination } from "@/types/domain/vaccination";
import type { ClinicRole } from "@/types/domain/clinic";
import type { MeResponse } from "@/types/api/me";
import type { Visit, VisitStatus } from "@/types/domain/visit";

const AI_SUMMARY_ROLES: ClinicRole[] = ["owner", "admin", "veterinarian"];

const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  in_progress: "בטיפול",
  completed: "הושלם",
  cancelled: "בוטל",
};

type Params = { params: Promise<{ visitId: string }> };

export default async function VisitDetailPage({ params }: Params) {
  const { visitId } = await params;
  const [visit, me] = await Promise.all([
    dashboardApiFetch<Visit>(`/api/visits/${visitId}`),
    dashboardApiFetch<MeResponse>("/api/me"),
  ]);

  if (!visit) {
    return (
      <section className="rounded-[var(--r-lg)] border border-[var(--red-100)] bg-[var(--red-50)] p-6 text-sm text-[var(--red-700)]">
        הביקור לא נמצא.
      </section>
    );
  }

  const [notesData, prescriptionsData, vaccinationsData, customer, pet] = await Promise.all([
    dashboardApiFetch<{ items: MedicalNote[] }>(`/api/visits/${visitId}/notes`),
    dashboardApiFetch<{ items: Prescription[] }>(`/api/visits/${visitId}/prescriptions`),
    dashboardApiFetch<{ items: Vaccination[] }>(
      `/api/pets/${visit.petId}/vaccinations?clinicId=${encodeURIComponent(visit.clinicId)}`,
    ),
    dashboardApiFetch<Customer>(`/api/customers/${visit.customerId}`),
    dashboardApiFetch<Pet>(`/api/pets/${visit.petId}`),
  ]);

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-5 p-6">
      <Link href={`/dashboard/pets/${visit.petId}`} className="text-sm font-semibold text-[var(--brand-600)] hover:underline">
        ← חזרה לכרטיס המטופל
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] p-5">
        <div>
          <h1 className="text-[22px] font-extrabold text-[var(--ink)]">מפגש טיפולי</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{formatIsraelDateTime(visit.startedAt)}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-end">
            <p className="text-[11px] text-[var(--muted)]">מטופל</p>
            <p className="text-sm font-bold text-[var(--ink)]">{pet?.name ?? visit.petId}</p>
          </div>
          <div className="text-end">
            <p className="text-[11px] text-[var(--muted)]">בעלים</p>
            <p className="text-sm font-bold text-[var(--ink)]">{customer?.fullName ?? visit.customerId}</p>
          </div>
          <Badge color={visit.status === "completed" ? "green" : visit.status === "cancelled" ? "muted" : "brand"}>
            {VISIT_STATUS_LABELS[visit.status]}
          </Badge>
        </div>
      </div>

      {visit.chiefComplaint && (
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">סיבת הביקור</p>
          <p className="mt-1 text-sm text-[var(--ink)]">{visit.chiefComplaint}</p>
        </Card>
      )}

      <Card>
        <h3 className="text-[15px] font-bold text-[var(--ink)]">סיכומי ביקור</h3>
        <div className="mt-3">
          <VisitAiSummarySection
            visitId={visit.id}
            visitVersion={visit.version}
            visitStatus={visit.status}
            manualVisitSummary={visit.manualVisitSummary}
            aiVisitSummary={visit.aiVisitSummary}
            canUseAi={
              me?.memberships.some(
                (m) =>
                  m.clinicId === visit.clinicId && AI_SUMMARY_ROLES.includes(m.role),
              ) ?? false
            }
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-[15px] font-bold text-[var(--ink)]">קליטה והיסטוריה (SOAP)</h3>
        <p className="mt-0.5 text-xs text-[var(--muted)]">תלונת לקוח, ממצאים, הערכה ותוכנית טיפול — לפי סוג הערה</p>
        <div className="mt-3">
          <VisitNotesSection visitId={visit.id} initialNotes={notesData?.items ?? []} />
        </div>
      </Card>

      <Card>
        <h3 className="text-[15px] font-bold text-[var(--ink)]">מרשמים</h3>
        <div className="mt-3">
          <VisitPrescriptionsSection
            visitId={visit.id}
            initialPrescriptions={prescriptionsData?.items ?? []}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-[15px] font-bold text-[var(--ink)]">חיסונים</h3>
        <div className="mt-3">
          <VisitVaccinationsSection
            visitId={visit.id}
            clinicId={visit.clinicId}
            customerId={visit.customerId}
            petId={visit.petId}
            initialVaccinations={vaccinationsData?.items ?? []}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-[15px] font-bold text-[var(--ink)]">שליחה ללקוח</h3>
        <div className="mt-3">
          <VisitShareSection
            visitId={visit.id}
            hasSummary={Boolean(visit.aiVisitSummary ?? visit.manualVisitSummary)}
            hasPrescriptions={
              (prescriptionsData?.items ?? []).some((p) => p.status === "active")
            }
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-[15px] font-bold text-[var(--ink)]">פעולות</h3>
        <div className="mt-3">
          <VisitActions
            visitId={visit.id}
            currentVersion={visit.version}
            currentStatus={visit.status}
          />
        </div>
      </Card>
    </div>
  );
}
