import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import type { MeResponse } from "@/types/api/me";

const quickActions = [
  {
    href: "/dashboard/calendar",
    title: "לוח שנה",
    description: "תורים של היום והשבוע במבט אחד",
    accent: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  {
    href: "/dashboard/appointments/new",
    title: "תור חדש",
    description: "קביעת תור ללקוחה קיימת או חדשה",
    accent: "bg-sky-50 text-sky-800 border-sky-200",
  },
  {
    href: "/dashboard/customers",
    title: "לקוחות וחיות מחמד",
    description: "ניהול בעלי החיות ובעליהם",
    accent: "bg-violet-50 text-violet-800 border-violet-200",
  },
  {
    href: "/dashboard/visits",
    title: "ביקורים וסיכומי AI",
    description: "תיעוד רפואי וסיכומים אוטומטיים בעברית",
    accent: "bg-amber-50 text-amber-800 border-amber-200",
  },
];

function extractFirstName(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.split(/[\s@]/)[0] ?? null;
}

export default async function DashboardPage() {
  const context = await dashboardApiFetch<MeResponse>("/api/me");

  const firstName =
    extractFirstName(context?.user.email) ?? null;

  const clinicName =
    context?.memberships?.[0]?.clinicName ?? "הקליניקה שלך";

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium tracking-wide text-emerald-700">
          {clinicName}
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900">
          {firstName ? `שלום, ${firstName} 👋` : "ברוכה הבאה"}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          זה לוח הבקרה של המערכת. מכאן את יכולה לנהל לקוחות, חיות מחמד, תורים
          וביקורים — וליצור סיכומי ביקור בעברית בעזרת AI.
        </p>

        {!context ? (
          <p className="mt-4 text-sm text-amber-700">
            לא ניתן לטעון את פרטי המשתמש. בדקי את החיבור לשרת.
          </p>
        ) : context.memberships.length === 0 ? (
          <p className="mt-4 text-sm text-amber-700">
            המשתמש שלך עדיין לא משויך לקליניקה. פני למנהל המערכת.
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          פעולות מהירות
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`block rounded-2xl border p-5 transition hover:shadow-md ${action.accent}`}
            >
              <p className="text-base font-semibold">{action.title}</p>
              <p className="mt-1 text-sm opacity-90">{action.description}</p>
              <p className="mt-3 text-sm font-medium">לעבור →</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
