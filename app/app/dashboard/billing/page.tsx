"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/dashboard/ui/card";
import { Badge } from "@/components/dashboard/ui/badge";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { Skeleton } from "@/components/dashboard/ui/skeleton";
import { CreditCardIcon } from "@/components/dashboard/icons";
import { InvoiceDraft } from "@/components/dashboard/billing/invoice-draft";
import { PaymentForm } from "@/components/dashboard/billing/payment-form";
import type { Invoice, InvoiceStatus } from "@/types/domain/invoice";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "טיוטה",
  sent: "נשלח",
  paid: "שולם",
  void: "בוטל",
};

const STATUS_COLOR: Record<InvoiceStatus, "muted" | "amber" | "green" | "red"> = {
  draft: "muted",
  sent: "amber",
  paid: "green",
  void: "red",
};

const STATUS_FILTERS: Array<{ value: InvoiceStatus | "all"; label: string }> = [
  { value: "all", label: "הכל" },
  { value: "draft", label: "טיוטה" },
  { value: "sent", label: "נשלח" },
  { value: "paid", label: "שולם" },
  { value: "void", label: "בוטל" },
];

function fmtMoney(n: number) {
  return `₪${n.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/invoices");
      if (res.ok) {
        const d = await res.json() as { data: { items: Invoice[] } };
        setInvoices(d.data.items ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const filtered = filter === "all" ? invoices : invoices.filter((inv) => inv.status === filter);
  const totalOutstanding = invoices
    .filter((inv) => inv.status === "sent")
    .reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-extrabold text-[var(--ink)]">חיובים</h1>
        <Card className="px-4 py-2.5">
          <p className="text-[11px] text-[var(--muted)]">חוב פתוח (נשלח, טרם שולם)</p>
          <p className="text-[18px] font-extrabold tabular-nums text-[var(--amber-600)]">{fmtMoney(totalOutstanding)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={[
              "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
              filter === f.value
                ? "border-[var(--brand-400)] bg-[var(--brand-100)] text-[var(--brand-800)]"
                : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<CreditCardIcon size={32} />} title="אין חשבוניות" subtitle="חשבוניות שהופקו יופיעו כאן" />
      ) : (
        <Card noPad className="overflow-hidden">
          <div className="divide-y divide-[var(--line-2)]">
            {filtered.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-[var(--ink)]">#{inv.invoiceNumber}</p>
                  <Link
                    href={`/dashboard/clients?customerId=${inv.customerId}`}
                    className="text-xs text-[var(--brand-600)] hover:underline"
                  >
                    {inv.customerName ?? inv.customerId}
                  </Link>
                  {inv.petName && <span className="text-xs text-[var(--muted)]"> · {inv.petName}</span>}
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                  <p className="text-xs text-[var(--muted)]">{fmtDate(inv.issuedAt)}</p>
                  <p className="text-sm font-extrabold tabular-nums text-[var(--ink)]">{fmtMoney(inv.total)}</p>
                  <Badge color={STATUS_COLOR[inv.status]}>{STATUS_LABEL[inv.status]}</Badge>
                  {inv.status === "draft" ? <InvoiceDraft invoice={inv} /> : null}
                  {inv.status === "sent" ? <PaymentForm clinicId={inv.clinicId} invoiceId={inv.id} /> : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
