import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import type { Customer } from "@/types/domain/customer";

type SearchParams = Promise<{ q?: string }>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim();
  const endpoint = query ? `/api/customers?q=${encodeURIComponent(query)}` : "/api/customers";
  const data = await dashboardApiFetch<{ items: Customer[] }>(endpoint);
  const customers = data?.items ?? [];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">לקוחות</h2>
        <Link
          href="/dashboard/customers/new"
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
        >
          לקוחה חדשה
        </Link>
      </div>

      <form action="/dashboard/customers" className="flex gap-2">
        <input
          name="q"
          defaultValue={query ?? ""}
          placeholder="חיפוש לפי שם, טלפון או אימייל"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
        >
          חיפוש
        </button>
      </form>

      <div className="rounded-2xl border border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-200">
          {customers.length === 0 ? (
            <li className="p-4 text-sm text-zinc-500">
              {query
                ? `לא נמצאו לקוחות תואמים ל-"${query}".`
                : "עדיין אין לקוחות. לחצי על \"לקוחה חדשה\" כדי להתחיל."}
            </li>
          ) : (
            customers.map((customer) => (
              <li key={customer.id} className="p-4">
                <Link
                  href={`/dashboard/customers/${customer.id}`}
                  className="font-medium text-zinc-900 hover:text-emerald-700"
                >
                  {customer.fullName}
                </Link>
                <p className="text-sm text-zinc-600">
                  {customer.phone ?? "ללא טלפון"} · {customer.email ?? "ללא אימייל"}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
