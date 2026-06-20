import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { formatIsraelDateTime } from "@/lib/israel-date";
import type { Visit, VisitStatus } from "@/types/domain/visit";

type SearchParams = Promise<{ petId?: string; clinicId?: string }>;

const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  in_progress: "בטיפול",
  completed: "הושלם",
  cancelled: "בוטל",
};

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
        <h2 className="text-xl font-semibold text-zinc-900">ביקורים</h2>
        <Link
          href={newHref}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
        >
          ביקור חדש
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-200">
          {items.length === 0 ? (
            <li className="p-4 text-sm text-zinc-500">לא נמצאו ביקורים.</li>
          ) : (
            items.map((visit) => (
              <li key={visit.id} className="p-4">
                <Link
                  href={`/dashboard/visits/${visit.id}`}
                  className="font-medium text-zinc-900 hover:text-emerald-700"
                >
                  {formatIsraelDateTime(visit.startedAt)} ·{" "}
                  {VISIT_STATUS_LABELS[visit.status]}
                </Link>
                <p className="text-sm text-zinc-600">
                  {visit.chiefComplaint ?? "לא נרשמה סיבת ביקור"}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
