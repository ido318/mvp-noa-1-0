"use client";
import React, { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { Btn } from "@/components/dashboard/ui/btn";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { PersonAvatar, AnimalAvatar } from "@/components/dashboard/ui/avatar";
import { SearchIcon, PhoneIcon, MailIcon, PinIcon, XIcon, ChevRightIcon } from "@/components/dashboard/icons";
import { NewCustomerModal } from "@/components/dashboard/new-customer-modal";
import { NewPetModal } from "@/components/dashboard/new-pet-modal";
import { InvoicesSection } from "@/components/dashboard/invoices-section";
import type { Customer } from "@/types/domain/customer";
import type { Pet } from "@/types/domain/pet";
import type { Appointment } from "@/types/domain/appointment";
import type { Visit } from "@/types/domain/visit";

// ─── helpers ──────────────────────────────────────────────────────────────────

const TZ = "Asia/Jerusalem";
function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function waPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
}

function petAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const diff = Date.now() - new Date(birthDate).getTime();
  const years = Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  if (years >= 1) return `${years} שנ'`;
  const months = Math.floor(diff / (30.4 * 24 * 3600 * 1000));
  return months > 0 ? `${months} חו'` : "גור";
}

// ─── PetCard ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function PetCard({ pet }: { pet: Pet }) {
  const age = petAge(pet.birthDate);
  return (
    <Link href={`/dashboard/pets/${pet.id}`} className="block">
      <Card hover>
        <div className="flex items-start gap-3">
          <AnimalAvatar species={pet.species} size={36} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-[14px] text-[var(--ink)]">{pet.name}</p>
              {pet.isNeutered && <Badge color="muted">מעוקר/ת</Badge>}
            </div>
            <p className="text-xs text-[var(--muted)]">
              {pet.species}{pet.breed ? ` · ${pet.breed}` : ""}{age ? ` · ${age}` : ""}
              {pet.sex === "male" ? " · זכר" : pet.sex === "female" ? " · נקבה" : ""}
            </p>
            {pet.weight && (
              <p className="mt-0.5 text-xs text-[var(--muted)]">{`${pet.weight} ק"ג`}</p>
            )}
            {pet.chronicConditions && (
              <p className="mt-1 text-xs text-[var(--red-700)] bg-[var(--red-50)] rounded px-1.5 py-0.5 inline-block">
                {pet.chronicConditions}
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

// ─── ClientProfile drawer ──────────────────────────────────────────────────────

function ClientProfile({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [apptLoading, setApptLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [showNewPet, setShowNewPet] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fetchPets = useCallback(async (showLoading = true) => {
    if (showLoading) setPetsLoading(true);
    const res = await fetch(`/api/pets?customerId=${customer.id}`);
    if (res.ok) {
      const d = await res.json() as { data: { items: Pet[] } };
      setPets(d.data.items ?? []);
    }
    setPetsLoading(false);
  }, [customer.id]);

  useEffect(() => {
    startTransition(() => {
      void fetchPets();
    });
  }, [fetchPets, startTransition]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/appointments?customerId=${customer.id}`);
      if (res.ok) {
        const d = await res.json() as { data: { items: Appointment[] } };
        const sorted = (d.data.items ?? []).sort(
          (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
        );
        setAppointments(sorted);
      }
      setApptLoading(false);
    })();
  }, [customer.id]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/visits?customerId=${customer.id}&limit=10`);
      if (res.ok) {
        const d = await res.json() as { data: { items: Visit[] } };
        setVisits(d.data.items ?? []);
      }
      setVisitsLoading(false);
    })();
  }, [customer.id]);

  const APPT_STATUS_LABELS: Record<string, string> = {
    scheduled: "מתוזמן",
    confirmed: "מאושר",
    completed: "הושלם",
    cancelled: "בוטל",
    no_show: "לא הגיע",
    pending_approval: "ממתין לאישור",
    late_cancellation: "ביטול מאוחר",
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed inset-y-0 start-0 z-50 flex w-full max-w-[480px] flex-col bg-[var(--surface)] shadow-[var(--sh-lg)] drawer-enter">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[var(--line)] px-5 py-4">
          <div className="flex items-center gap-3">
            <PersonAvatar initials={initials(customer.fullName)} size={44} />
            <div>
              <p className="text-[15px] font-extrabold text-[var(--ink)]">{customer.fullName}</p>
              <p className="text-xs text-[var(--muted)]">לקוח/ה מאז {fmtDate(customer.createdAt)}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-[var(--surface-2)]">
            <XIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Contact info */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">פרטי קשר</p>
            {customer.phone && (
              <>
                <div className="flex items-center gap-2 text-sm text-[var(--ink)]">
                  <PhoneIcon size={14} className="text-[var(--muted)]" />
                  <a href={`tel:${customer.phone}`} className="hover:text-[var(--brand-600)]">{customer.phone}</a>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`sms:${customer.phone}`} className="text-xs font-semibold text-[var(--brand-600)] hover:underline">שלח SMS</a>
                  <a
                    href={`https://wa.me/${waPhone(customer.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-[var(--brand-600)] hover:underline"
                  >
                    WhatsApp
                  </a>
                </div>
              </>
            )}
            {customer.email && (
              <div className="flex items-center gap-2 text-sm text-[var(--ink)]">
                <MailIcon size={14} className="text-[var(--muted)]" />
                <a href={`mailto:${customer.email}`} className="hover:text-[var(--brand-600)]">{customer.email}</a>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-2 text-sm text-[var(--ink)]">
                <PinIcon size={14} className="text-[var(--muted)]" />
                {customer.address}
              </div>
            )}
          </div>

          {/* Pets */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                חיות מחמד ({petsLoading ? "…" : pets.length})
              </p>
              <Btn size="sm" variant="ghost" onClick={() => setShowNewPet(true)}>+ הוסף חיה</Btn>
            </div>
            {petsLoading ? (
              <Skeleton className="h-24" />
            ) : pets.length === 0 ? (
              <p className="text-sm text-[var(--faint)]">אין חיות מחמד רשומות</p>
            ) : (
              <div className="space-y-2">
                {pets.map(pet => <PetCard key={pet.id} pet={pet} />)}
              </div>
            )}
          </div>

          {/* Appointment history */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              היסטוריית תורים ({apptLoading ? "…" : appointments.length})
            </p>
            {apptLoading ? (
              <Skeleton className="h-24" />
            ) : appointments.length === 0 ? (
              <p className="text-sm text-[var(--faint)]">אין תורים רשומים</p>
            ) : (
              <div className="rounded-[var(--r-lg)] border border-[var(--line)] divide-y divide-[var(--line-2)]">
                {appointments.slice(0, 10).map(appt => (
                  <div key={appt.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--ink)]">
                        {fmtDate(appt.scheduledAt)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{appt.appointmentType}</p>
                    </div>
                    <span className={[
                      "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                      appt.status === "completed" ? "bg-[#E9F5EF] text-[#2F7D5B]"
                        : appt.status === "cancelled" ? "bg-[var(--line-2)] text-[var(--muted)]"
                        : "bg-[var(--brand-50)] text-[var(--brand-700)]",
                    ].join(" ")}>
                      {APPT_STATUS_LABELS[appt.status] ?? appt.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visit history */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              ביקורים רפואיים ({visitsLoading ? "…" : visits.length})
            </p>
            {visitsLoading ? (
              <Skeleton className="h-24" />
            ) : visits.length === 0 ? (
              <p className="text-sm text-[var(--faint)]">אין ביקורים רשומים</p>
            ) : (
              <div className="rounded-[var(--r-lg)] border border-[var(--line)] divide-y divide-[var(--line-2)]">
                {visits.map(visit => (
                  <Link
                    key={visit.id}
                    href={`/dashboard/visits/${visit.id}`}
                    className="flex items-center justify-between px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--ink)]">{fmtDate(visit.startedAt)}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{visit.chiefComplaint ?? "ללא תלונה ראשית"}</p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {visit.aiVisitSummary && <Badge color="brand">AI</Badge>}
                      <span className={[
                        "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                        visit.status === "completed" ? "bg-[#E9F5EF] text-[#2F7D5B]"
                          : visit.status === "cancelled" ? "bg-[var(--line-2)] text-[var(--muted)]"
                          : "bg-[var(--brand-50)] text-[var(--brand-700)]",
                      ].join(" ")}>
                        {visit.status === "completed" ? "הושלם" : visit.status === "cancelled" ? "בוטל" : "בטיפול"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Billing */}
          <InvoicesSection clinicId={customer.clinicId} customerId={customer.id} />

          {/* Notes */}
          {customer.notes && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">הערות</p>
              <p className="text-sm text-[var(--ink)] leading-relaxed">{customer.notes}</p>
            </div>
          )}
        </div>
      </div>

      <NewPetModal
        open={showNewPet}
        onClose={() => setShowNewPet(false)}
        clinicId={customer.clinicId}
        customerId={customer.id}
        onCreated={() => { void fetchPets(false); }}
      />
    </>
  );
}

// ─── ClientCard ────────────────────────────────────────────────────────────────

function ClientCard({ customer, onClick }: { customer: Customer; onClick: () => void }) {
  return (
    <Card hover onClick={onClick}>
      <div className="flex items-center gap-3">
        <PersonAvatar initials={initials(customer.fullName)} size={36} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[14px] text-[var(--ink)] truncate">{customer.fullName}</p>
          <p className="text-xs text-[var(--muted)] truncate">{customer.phone ?? customer.email ?? "—"}</p>
        </div>
        <ChevRightIcon size={14} className="flex-shrink-0 text-[var(--faint)]" />
      </div>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [searching, setSearching] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const fetchData = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const params = q ? `?query=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/customers${params}`);
      if (res.ok) {
        const d = await res.json() as { data: { items: Customer[] } };
        setItems(d.data.items ?? []);
      }
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData("");
    });
  }, [fetchData]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { void fetchData(query); }, 300);
    return () => clearTimeout(t);
  }, [query, fetchData]);

  // Deep-link: /dashboard/clients?customerId=<id> opens that customer's profile directly
  const searchParams = useSearchParams();
  useEffect(() => {
    const customerId = searchParams.get("customerId");
    if (!customerId) return;
    void (async () => {
      const res = await fetch(`/api/customers/${customerId}`);
      if (res.ok) {
        const d = await res.json() as { data: Customer };
        setSelected(d.data);
      }
    })();
  }, [searchParams]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[var(--ink)]">לקוחות</h1>
        <span className="text-sm text-[var(--muted)]">{items.length} רשומים</span>
        <Btn size="sm" onClick={() => setShowNewCustomer(true)}>לקוח חדש</Btn>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <SearchIcon size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
        <input
          type="text"
          placeholder="חיפוש לפי שם, טלפון או מייל…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--surface)] py-2 pe-3 ps-9 text-sm text-[var(--ink)] placeholder:text-[var(--faint)] focus:outline-none focus:border-[var(--brand-400)]"
        />
        {searching && (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-[var(--brand-400)] border-t-transparent animate-spin" />
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={32} />}
          title={query ? "לא נמצאו לקוחות" : "אין לקוחות עדיין"}
          subtitle={query ? `אין תוצאות עבור "${query}"` : "לקוחות שיצרו קשר דרך תומר יופיעו כאן"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(customer => (
            <ClientCard
              key={customer.id}
              customer={customer}
              onClick={() => setSelected(customer)}
            />
          ))}
        </div>
      )}

      {/* Profile drawer */}
      {selected && (
        <ClientProfile customer={selected} onClose={() => setSelected(null)} />
      )}

      <NewCustomerModal
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onCreated={() => { void fetchData(query); }}
      />
    </div>
  );
}
