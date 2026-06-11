import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import type { Visit } from "@/types/domain/visit";

type SearchParams = Promise<{ petId?: string; clinicId?: string }>;

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.clinicId) query.set("clinicId", params.clinicId);
  if (params.petId) query.set("petId", params.petId);
  const endpoint = `/api/visits${query.toString() ? `?${query.toString()}` : ""}`;
  const response = await dashboardApiFetch<{ items: Visit[] }>(endpoint);
  const items = response?.items ?? [];

  const newHref = params.petId
    ? `/dashboard/visits/new?petId=${encodeURIComponent(params.petId)}`
    : "/dashboard/visits/new";

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">Visits</h2>
        <Link
          href={newHref}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
        >
          New visit
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-200">
          {items.length === 0 ? (
            <li className="p-4 text-sm text-zinc-500">No visits found.</li>
          ) : (
            items.map((visit) => (
              <li key={visit.id} className="p-4">
                <Link
                  href={`/dashboard/visits/${visit.id}`}
                  className="font-medium text-zinc-900 hover:text-emerald-700"
                >
                  {new Date(visit.startedAt).toLocaleString()} · {visit.status}
                </Link>
                <p className="text-sm text-zinc-600">
                  {visit.chiefComplaint ?? "No chief complaint recorded"}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
