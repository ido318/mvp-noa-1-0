import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = params.next ?? "/dashboard";

  return <LoginForm nextPath={nextPath} />;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-medium tracking-wide text-emerald-700">
          Maya · קליניקה וטרינרית
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">
          התחברות למערכת
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          הזיני את פרטי ההתחברות שלך כדי להמשיך
        </p>

        <Suspense
          fallback={<p className="mt-8 text-sm text-zinc-500">טוען...</p>}
        >
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
