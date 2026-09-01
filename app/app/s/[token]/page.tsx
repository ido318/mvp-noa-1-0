import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { VisitRepository } from "@/lib/repositories/visit.repository";
import { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import { PetRepository } from "@/lib/repositories/pet.repository";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { VisitShareRepository } from "@/lib/repositories/visit-share.repository";
import { formatIsraelDate } from "@/lib/israel-date";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

function ExpiredNotice() {
  return (
    <main dir="rtl" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <span
        aria-hidden="true"
        className="h-9 w-9"
        style={{
          background: "var(--text-faint)",
          WebkitMaskImage: "url(/logo-mark.svg)",
          maskImage: "url(/logo-mark.svg)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
      <h1 className="text-lg font-semibold text-zinc-900">הקישור אינו זמין</h1>
      <p className="text-sm text-zinc-600">
        ייתכן שהקישור פג תוקף או בוטל. לפרטים, אנא פנו ישירות למרפאה.
      </p>
    </main>
  );
}

export default async function VisitSharePage({ params }: Params) {
  const { token } = await params;
  const admin = createSupabaseAdminClient();

  const shareRepo = new VisitShareRepository(admin);
  const shareResult = await shareRepo.findLiveByToken(token);
  if (!shareResult.ok || !shareResult.value) return <ExpiredNotice />;
  const share = shareResult.value;

  const visitResult = await new VisitRepository(admin).findById(share.visitId);
  if (!visitResult.ok || !visitResult.value) return <ExpiredNotice />;
  const visit = visitResult.value;

  const [petResult, customerResult, prescriptionsResult] = await Promise.all([
    new PetRepository(admin).findById(visit.petId),
    new CustomerRepository(admin).findById(visit.customerId),
    new PrescriptionRepository(admin).listByVisit(visit.id),
  ]);

  const petName = petResult.ok ? (petResult.value?.name ?? "") : "";
  const customerName = customerResult.ok ? (customerResult.value?.fullName ?? "") : "";
  const prescriptions = prescriptionsResult.ok
    ? prescriptionsResult.value.filter((p) => p.status === "active")
    : [];
  const summary = visit.aiVisitSummary ?? visit.manualVisitSummary;

  // Best-effort view tracking; never block rendering on it.
  await shareRepo.recordView(share.id, share.viewCount).catch(() => undefined);

  return (
    <main dir="rtl" className="mx-auto min-h-screen max-w-md bg-zinc-50 p-5 text-zinc-900">
      <header className="mb-5 flex items-center gap-3 border-b border-zinc-200 pb-4">
        <span
        aria-hidden="true"
        className="h-8 w-8"
        style={{
          background: "var(--text-faint)",
          WebkitMaskImage: "url(/logo-mark.svg)",
          maskImage: "url(/logo-mark.svg)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
            מרפאת Get A Vet
          </p>
          <h1 className="text-lg font-semibold">סיכום ביקור</h1>
        </div>
      </header>

      <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {petName ? (
            <div>
              <dt className="text-zinc-500">חיה</dt>
              <dd className="font-medium">{petName}</dd>
            </div>
          ) : null}
          {customerName ? (
            <div>
              <dt className="text-zinc-500">בעלים</dt>
              <dd className="font-medium">{customerName}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-zinc-500">תאריך ביקור</dt>
            <dd className="font-medium">{formatIsraelDate(visit.startedAt)}</dd>
          </div>
          {visit.chiefComplaint ? (
            <div className="col-span-2">
              <dt className="text-zinc-500">סיבת הביקור</dt>
              <dd className="font-medium">{visit.chiefComplaint}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {summary ? (
        <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            סיכום הביקור
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">
            {summary}
          </p>
        </section>
      ) : null}

      {prescriptions.length > 0 ? (
        <section className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            מרשמים
          </h2>
          <ul className="space-y-3">
            {prescriptions.map((rx) => (
              <li key={rx.id} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                <p className="font-semibold text-zinc-900">{rx.medicationName}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{rx.instructions}</p>
                {rx.notes ? (
                  <p className="mt-1 text-xs text-zinc-500">{rx.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="mt-6 text-center text-xs text-zinc-400">
        הודעה זו נשלחה ממרפאת Get A Vet. אין להשיב להודעה זו.
      </footer>
    </main>
  );
}
