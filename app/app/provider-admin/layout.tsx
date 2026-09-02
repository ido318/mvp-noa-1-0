import { redirect } from "next/navigation";
import { createServices } from "@/lib/services/factory";
import { requireProviderAdmin } from "@/lib/api/provider-admin";
import { ToastProvider } from "@/components/dashboard/ui/toast";
import { ProviderAdminSidebar } from "@/components/provider-admin/sidebar";
import { AppError } from "@/lib/errors/app-error";

export default async function ProviderAdminLayout({ children }: { children: React.ReactNode }) {
  const services = await createServices();
  try {
    await requireProviderAdmin(services.auth);
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/login");
    redirect("/dashboard");
  }

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-canvas)" }}>
        <ProviderAdminSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </ToastProvider>
  );
}
