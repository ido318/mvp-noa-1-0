import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import type { Pet } from "@/types/domain/pet";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Visit } from "@/types/domain/visit";

type Params = { params: Promise<{ petId: string }> };

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
        Pet not found.
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href={`/dashboard/customers/${pet.customerId}`} className="text-sm text-emerald-700">
          ← Back to customer
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
            <dt className="text-zinc-500">Sex</dt>
            <dd>{pet.sex ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Birth date</dt>
            <dd>{pet.birthDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Weight</dt>
            <dd>{pet.weight ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Chip number</dt>
            <dd>{pet.chipNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Neutered</dt>
            <dd>{pet.isNeutered ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Status</dt>
            <dd>{pet.status}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Notes</h3>
        <p className="mt-2 text-sm text-zinc-700">{pet.notes ?? "No notes yet."}</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Medical history
          </h3>
          <Link
            href={`/dashboard/visits?petId=${encodeURIComponent(petId)}`}
            className="text-sm text-emerald-700"
          >
            All visits
          </Link>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <h4 className="text-sm font-medium text-zinc-800">Recent visits</h4>
            <ul className="mt-2 space-y-2">
              {(visitsData?.items ?? []).length === 0 ? (
                <li className="text-sm text-zinc-500">No visits recorded.</li>
              ) : (
                (visitsData?.items ?? []).map((visit) => (
                  <li key={visit.id}>
                    <Link
                      href={`/dashboard/visits/${visit.id}`}
                      className="text-sm text-emerald-700"
                    >
                      {new Date(visit.startedAt).toLocaleString()} · {visit.status}
                    </Link>
                  </li>
                ))
              )}
            </ul>
            <Link
              href={`/dashboard/visits/new?petId=${encodeURIComponent(petId)}`}
              className="mt-2 inline-block text-sm text-emerald-700"
            >
              + New visit
            </Link>
          </div>
          <div>
            <h4 className="text-sm font-medium text-zinc-800">Vaccinations</h4>
            <ul className="mt-2 space-y-1">
              {(vaccinationsData?.items ?? []).slice(0, 5).map((v) => (
                <li key={v.id} className="text-sm text-zinc-600">
                  {v.vaccineName} · {new Date(v.administeredAt).toLocaleDateString()}
                </li>
              ))}
              {(vaccinationsData?.items ?? []).length === 0 ? (
                <li className="text-sm text-zinc-500">No vaccinations recorded.</li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
