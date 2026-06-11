import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { VisitActions } from "@/app/dashboard/visits/visit-actions";
import { VisitAiSummarySection } from "@/app/dashboard/visits/visit-ai-summary-section";
import { VisitNotesSection } from "@/app/dashboard/visits/visit-notes-section";
import { VisitPrescriptionsSection } from "@/app/dashboard/visits/visit-prescriptions-section";
import { VisitVaccinationsSection } from "@/app/dashboard/visits/visit-vaccinations-section";
import type { MedicalNote } from "@/types/domain/medical-note";
import type { Prescription } from "@/types/domain/prescription";
import type { Vaccination } from "@/types/domain/vaccination";
import type { ClinicRole } from "@/types/domain/clinic";
import type { MeResponse } from "@/types/api/me";
import type { Visit } from "@/types/domain/visit";

const AI_SUMMARY_ROLES: ClinicRole[] = ["owner", "admin", "veterinarian"];

type Params = { params: Promise<{ visitId: string }> };

export default async function VisitDetailPage({ params }: Params) {
  const { visitId } = await params;
  const [visit, me] = await Promise.all([
    dashboardApiFetch<Visit>(`/api/visits/${visitId}`),
    dashboardApiFetch<MeResponse>("/api/me"),
  ]);

  if (!visit) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Visit not found.
      </section>
    );
  }

  const [notesData, prescriptionsData, vaccinationsData] = await Promise.all([
    dashboardApiFetch<{ items: MedicalNote[] }>(`/api/visits/${visitId}/notes`),
    dashboardApiFetch<{ items: Prescription[] }>(`/api/visits/${visitId}/prescriptions`),
    dashboardApiFetch<{ items: Vaccination[] }>(
      `/api/pets/${visit.petId}/vaccinations?clinicId=${encodeURIComponent(visit.clinicId)}`,
    ),
  ]);

  return (
    <section className="space-y-6">
      <div>
        <Link href="/dashboard/visits" className="text-sm text-emerald-700">
          ← Back to visits
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900">
          Visit · {new Date(visit.startedAt).toLocaleString()}
        </h2>
        <p className="text-sm text-zinc-600">Status: {visit.status}</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <dl className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Pet</dt>
            <dd>
              <Link href={`/dashboard/pets/${visit.petId}`} className="text-emerald-700">
                {visit.petId}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Customer</dt>
            <dd>{visit.customerId}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Chief complaint</dt>
            <dd>{visit.chiefComplaint ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Version</dt>
            <dd>{visit.version}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Visit summaries
        </h3>
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
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Actions</h3>
        <div className="mt-3">
          <VisitActions
            visitId={visit.id}
            currentVersion={visit.version}
            currentStatus={visit.status}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Notes</h3>
        <div className="mt-3">
          <VisitNotesSection visitId={visit.id} initialNotes={notesData?.items ?? []} />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Vaccinations
        </h3>
        <div className="mt-3">
          <VisitVaccinationsSection
            visitId={visit.id}
            clinicId={visit.clinicId}
            customerId={visit.customerId}
            petId={visit.petId}
            initialVaccinations={vaccinationsData?.items ?? []}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Prescriptions
        </h3>
        <div className="mt-3">
          <VisitPrescriptionsSection
            visitId={visit.id}
            initialPrescriptions={prescriptionsData?.items ?? []}
          />
        </div>
      </div>
    </section>
  );
}
