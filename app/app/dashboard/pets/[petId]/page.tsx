import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { formatIsraelDate, formatIsraelDateTime } from "@/lib/israel-date";
import { PetProfileForm } from "@/app/dashboard/pets/[petId]/pet-profile-form";
import type { Pet } from "@/types/domain/pet";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Visit, VisitStatus } from "@/types/domain/visit";

type Params = { params: Promise<{ petId: string }> };

const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  in_progress: "בטיפול",
  completed: "הושלם",
  cancelled: "בוטל",
};

const PET_SEX_LABELS: Record<string, string> = {
  male: "זכר",
  female: "נקבה",
  unknown: "לא ידוע",
};

const PET_STATUS_LABELS: Record<string, string> = {
  active: "פעיל",
  inactive: "לא פעיל",
};

export default async function PetProfilePage({ params }: Params) {
  const { petId } = await params;
  const pet = await dashboardApiFetch<Pet>(`/api/pets/${petId}`);

  const visitsData = pet
    ? await dashboardApiFetch<{ items: Visit[] }>(
        `/api/visits?petId=${encodeURIComponent(petId)}&clinicId=${encodeURIComponent(pet.clinicId)}&limit=5`,
      )
    : null;
  const vaccinationsData = pet
    ? await dashboardApiFetch<{ items: Vaccination[] }>(
        `/api/pets/${petId}/vaccinations?clinicId=${encodeURIComponent(pet.clinicId)}`,
      )
    : null;

  if (!pet) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        החיה לא נמצאה.
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href={`/dashboard/clients?customerId=${pet.customerId}`} className="text-sm text-emerald-700">
          חזרה ללקוח
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900">{pet.name}</h2>
        <p className="text-sm text-zinc-600">
          {pet.species}
          {pet.breed ? ` · ${pet.breed}` : ""}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <dl className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">מין</dt>
            <dd>{pet.sex ? (PET_SEX_LABELS[pet.sex] ?? pet.sex) : "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">תאריך לידה</dt>
            <dd>{pet.birthDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">משקל</dt>
            <dd>{pet.weight ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">מספר שבב</dt>
            <dd>{pet.chipNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">מעוקר/מסורס</dt>
            <dd>{pet.isNeutered ? "כן" : "לא"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">סטטוס</dt>
            <dd>{PET_STATUS_LABELS[pet.status] ?? pet.status}</dd>
          </div>
        </dl>
      </div>

      <PetProfileForm pet={pet} />

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">הערות</h3>
        <p className="mt-2 text-sm text-zinc-700">{pet.notes ?? "אין עדיין הערות."}</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            היסטוריה רפואית
          </h3>
          <Link
            href={`/dashboard/visits?petId=${encodeURIComponent(petId)}`}
            className="text-sm text-emerald-700"
          >
            כל הביקורים
          </Link>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-zinc-800">ביקורים אחרונים</h4>
            <ul className="mt-2 space-y-2">
              {(visitsData?.items ?? []).length === 0 ? (
                <li className="text-sm text-zinc-500">לא נרשמו ביקורים.</li>
              ) : (
                (visitsData?.items ?? []).map((visit) => (
                  <li key={visit.id}>
                    <Link
                      href={`/dashboard/visits/${visit.id}`}
                      className="text-sm text-emerald-700"
                    >
                      {formatIsraelDateTime(visit.startedAt)} ·{" "}
                      {VISIT_STATUS_LABELS[visit.status]}
                    </Link>
                  </li>
                ))
              )}
            </ul>
            <Link
              href={`/dashboard/visits/new?petId=${encodeURIComponent(petId)}`}
              className="mt-2 inline-block text-sm text-emerald-700"
            >
              + ביקור חדש
            </Link>
          </div>
          <div>
            <h4 className="text-sm font-medium text-zinc-800">חיסונים</h4>
            <ul className="mt-2 space-y-1">
              {(vaccinationsData?.items ?? []).slice(0, 5).map((v) => (
                <li key={v.id} className="text-sm text-zinc-600">
                  {v.vaccineName} · {formatIsraelDate(v.administeredAt)}
                  {v.nextDueAt && (
                    <span className="text-zinc-400"> · הבא: {formatIsraelDate(v.nextDueAt)}</span>
                  )}
                </li>
              ))}
              {(vaccinationsData?.items ?? []).length === 0 ? (
                <li className="text-sm text-zinc-500">לא נרשמו חיסונים.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
