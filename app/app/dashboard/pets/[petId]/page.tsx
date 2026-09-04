import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { AnimalIcon } from "@/components/dashboard/icons";
import { PetDetailTabs } from "@/app/dashboard/pets/[petId]/pet-detail-tabs";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Prescription } from "@/types/domain/prescription";
import type { Visit } from "@/types/domain/visit";
import type { MedicalRecord } from "@/types/domain/medical-record";
import type { MedicalRecordTimelineResponse } from "@/types/api/medical-record-timeline";

type Params = { params: Promise<{ petId: string }> };

const PET_SEX_LABELS: Record<string, string> = {
  male: "זכר",
  female: "נקבה",
  unknown: "לא ידוע",
};

function petAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  if (years >= 1) return `${years} שנים`;
  const months = Math.floor(diff / (30.4 * 24 * 3600 * 1000));
  return months > 0 ? `${months} חודשים` : "גור";
}

export default async function PetProfilePage({ params }: Params) {
  const { petId } = await params;
  const pet = await dashboardApiFetch<Pet>(`/api/pets/${petId}`);

  if (!pet) {
    return (
      <section className="rounded-[var(--r-lg)] border border-[var(--red-100)] bg-[var(--red-50)] p-6 text-sm text-[var(--red-700)]">
        החיה לא נמצאה.
      </section>
    );
  }

  const [visitsData, vaccinationsData, prescriptionsData, owner, medicalRecordData, timelineData] = await Promise.all([
    dashboardApiFetch<{ items: Visit[] }>(
      `/api/visits?petId=${encodeURIComponent(petId)}&clinicId=${encodeURIComponent(pet.clinicId)}&limit=10`,
    ),
    dashboardApiFetch<{ items: Vaccination[] }>(
      `/api/pets/${petId}/vaccinations?clinicId=${encodeURIComponent(pet.clinicId)}`,
    ),
    dashboardApiFetch<{ items: Prescription[] }>(`/api/pets/${petId}/prescriptions`),
    dashboardApiFetch<Customer>(`/api/customers/${pet.customerId}`),
    dashboardApiFetch<{ item: MedicalRecord }>(`/api/pets/${petId}/medical-record`),
    dashboardApiFetch<MedicalRecordTimelineResponse>(`/api/pets/${petId}/medical-record/timeline`),
  ]);

  const age = petAge(pet.birthDate);
  const hasAlerts = Boolean(pet.allergies || pet.chronicConditions);

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-5 p-6">
      <Link href={`/dashboard/clients?customerId=${pet.customerId}`} className="text-sm font-semibold text-[var(--brand-600)] hover:underline">
        ← חזרה ללקוח
      </Link>

      {/* Hero */}
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center gap-6">
          {pet.weight != null && (
            <div className="text-end">
              <p className="text-[11px] text-[var(--muted)]">משקל אחרון</p>
              <p className="text-[20px] font-semibold tabular-nums text-[var(--ink)]">{pet.weight} ק״ג</p>
            </div>
          )}
          {age && (
            <div className="text-end">
              <p className="text-[11px] text-[var(--muted)]">גיל</p>
              <p className="text-[20px] font-semibold text-[var(--ink)]">{age}</p>
            </div>
          )}
          {owner && (
            <div className="text-end">
              <p className="text-[11px] text-[var(--muted)]">בעלים</p>
              <Link href={`/dashboard/clients?customerId=${owner.id}`} className="text-[16px] font-semibold text-[var(--brand-600)] hover:underline">
                {owner.fullName}
              </Link>
              {owner.phone && <p className="text-xs text-[var(--muted)]">{owner.phone}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-end">
            <div className="flex items-center gap-2">
              {pet.isNeutered && <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-[var(--status-info-text)] bg-[var(--status-info-wash)]">מעוקר/ת</span>}
              <p className="text-[20px] font-semibold text-[var(--ink)]">{pet.name}</p>
            </div>
            <p className="text-sm text-[var(--ink-2)]">
              {pet.species}{pet.breed ? ` · ${pet.breed}` : ""}
              {pet.sex ? ` · ${PET_SEX_LABELS[pet.sex] ?? pet.sex}` : ""}
            </p>
          </div>
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--brand-100)]">
            <AnimalIcon species={pet.species} size={32} />
          </span>
        </div>
      </div>

      {/* Medical alerts */}
      {hasAlerts && (
        <div className="space-y-2">
          {pet.allergies && (
            <div className="flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--red-500)] bg-[var(--red-50)] p-3">
              <p className="text-[13px] font-semibold text-[var(--red-700)]">אלרגיה: {pet.allergies}</p>
            </div>
          )}
          {pet.chronicConditions && (
            <div className="flex items-start gap-2 rounded-[var(--r-md)] border border-[var(--amber-500)] bg-[var(--amber-50)] p-3">
              <p className="text-[13px] font-semibold text-[var(--amber-600)]">מצב כרוני: {pet.chronicConditions}</p>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap justify-end gap-2">
        {owner?.phone && (
          <a href={`tel:${owner.phone}`} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]">
            התקשר לבעלים
          </a>
        )}
        <Link
          href={`/dashboard/calendar?newAppointment=1&customerId=${pet.customerId}&petId=${pet.id}`}
          className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)]"
        >
          קבע תור
        </Link>
        <Link href={`/dashboard/visits/new?petId=${pet.id}`} className="rounded-full bg-[var(--brand-600)] px-4 py-2 text-[13px] font-semibold text-white">
          פתח ביקור חדש
        </Link>
      </div>

      <PetDetailTabs
        pet={pet}
        clinicId={pet.clinicId}
        visits={visitsData?.items ?? []}
        vaccinations={vaccinationsData?.items ?? []}
        prescriptions={prescriptionsData?.items ?? []}
        medicalRecord={medicalRecordData?.item ?? null}
        timelineItems={timelineData?.items ?? []}
        owner={owner ?? null}
      />
    </div>
  );
}
