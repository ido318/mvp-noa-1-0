import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-emerald-700">
              Maya · קליניקה וטרינרית
            </p>
            <h1 className="text-lg font-semibold text-zinc-900">לוח בקרה</h1>
            <nav className="mt-2 flex gap-4 text-sm">
              <Link href="/dashboard" className="text-zinc-600 hover:text-zinc-900">
                בית
              </Link>
              <Link
                href="/dashboard/customers"
                className="text-zinc-600 hover:text-zinc-900"
              >
                לקוחות
              </Link>
              <Link
                href="/dashboard/appointments"
                className="text-zinc-600 hover:text-zinc-900"
              >
                תורים
              </Link>
              <Link
                href="/dashboard/calendar"
                className="text-zinc-600 hover:text-zinc-900"
              >
                לוח שנה
              </Link>
              <Link
                href="/dashboard/visits"
                className="text-zinc-600 hover:text-zinc-900"
              >
                ביקורים
              </Link>
            </nav>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
