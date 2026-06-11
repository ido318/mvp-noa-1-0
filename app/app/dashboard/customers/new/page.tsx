import Link from "next/link";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import { CustomerForm } from "@/app/dashboard/customers/customer-form";
import type { MeResponse } from "@/types/api/me";

export default async function NewCustomerPage() {
  const context = await dashboardApiFetch<MeResponse>("/api/me");
  const clinicId =
    context?.profile.defaultClinicId ?? context?.memberships[0]?.clinicId ?? null;

  if (!clinicId) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        No clinic available for creating customers.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <Link href="/dashboard/customers" className="text-sm text-emerald-700">
          ← Back to customers
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900">New customer</h2>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <CustomerForm clinicId={clinicId} />
      </div>
    </section>
  );
}
