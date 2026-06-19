import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { Badge } from "@/components/dashboard/ui/badge";
import { Card } from "@/components/dashboard/ui/card";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { RecordsIcon } from "@/components/dashboard/icons";
import type { Visit } from "@/types/domain/visit";

function statusHe(status: Visit["status"]): string {
  if (status === "completed") return "הושלם";
  if (status === "cancelled") return "בוטל";
  return "בטיפול";
}

function statusColor(status: Visit["status"]): "green" | "red" | "amber" {
  if (status === "completed") return "green";
  if (status === "cancelled") return "red";
  return "amber";
}

export default async function RecordsPage() {
  const data = await dashboardApiFetch<{ items: Visit[] }>("/api/visits?limit=50");
  const visits = data?.items ?? [];
  const completed = visits.filter((visit) => visit.status === "completed").length;
  const withAi = visits.filter((visit) => Boolean(visit.aiVisitSummary)).length;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--ink)]">תיקים רפואיים</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">ביקורים, סיכומי AI, הערות, תרופות וחיסונים.</p>
        </div>
        <Link
          href="/dashboard/visits/new"
          className="rounded-[11px] bg-[var(--brand-600)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          ביקור חדש
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <p className="text-xs text-[var(--muted)]">ביקורים</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--ink)]">{visits.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">הושלמו</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--ink)]">{completed}</p>
        </Card>
        <Card>
          <p className="text-xs text-[var(--muted)]">עם סיכום AI</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--ink)]">{withAi}</p>
        </Card>
      </div>

      {visits.length === 0 ? (
        <EmptyState
          icon={<RecordsIcon size={36} />}
          title="אין ביקורים"
          subtitle="ביקורים רפואיים, סיכומי AI, תרופות וחיסונים יופיעו כאן"
        />
      ) : (
        <Card noPad>
          <ul className="divide-y divide-[var(--line-2)]">
            {visits.map((visit) => (
              <li key={visit.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/visits/${visit.id}`}
                      className="font-bold text-[var(--ink)] hover:text-[var(--brand-700)]"
                    >
                      {new Intl.DateTimeFormat("he-IL", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Jerusalem",
                      }).format(new Date(visit.startedAt))}
                    </Link>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {visit.chiefComplaint ?? "ללא תלונה ראשית"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {visit.manualVisitSummary && <Badge color="muted">סיכום ידני</Badge>}
                      {visit.aiVisitSummary && <Badge color="brand">סיכום AI</Badge>}
                      <Link className="text-xs font-semibold text-[var(--brand-700)]" href={`/dashboard/pets/${visit.petId}`}>
                        פרופיל חיה
                      </Link>
                    </div>
                  </div>
                  <Badge color={statusColor(visit.status)}>{statusHe(visit.status)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
