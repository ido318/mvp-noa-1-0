import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { ToastProvider } from "@/components/dashboard/ui/toast";
import { dashboardApiFetch } from "@/app/dashboard/api-client";
import type { MeResponse } from "@/types/api/me";

async function getOpenEscalationCount(): Promise<number> {
  try {
    const data = await dashboardApiFetch<{ count: number }>("/api/escalations/count");
    return data?.count ?? 0;
  } catch {
    return 0;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [me, openEscalations] = await Promise.all([
    dashboardApiFetch<MeResponse>("/api/me"),
    getOpenEscalationCount(),
  ]);

  const clinicName = me?.memberships?.[0]?.clinicName ?? "Get A Vet";

  return (
    <ToastProvider>
      {/* Full-height RTL flex container: content area + sidebar (sidebar on the right in RTL) */}
      <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
        {/* Main content (flex-1, scroll here) */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <Header
            clinicName={clinicName}
            clinicLocation="מגדלי גינדי TLV · תל אביב"
            openEscalations={openEscalations}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="page-enter">
              {children}
            </div>
          </main>
        </div>

        {/* Sidebar (right in RTL) */}
        <Sidebar openEscalations={openEscalations} />
      </div>
    </ToastProvider>
  );
}
