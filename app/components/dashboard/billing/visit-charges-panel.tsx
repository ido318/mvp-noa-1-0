"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";
import { Badge } from "@/components/dashboard/ui/badge";
import type { VisitCharge } from "@/types/domain/visit-charge";

export function VisitChargesPanel({
  visitId,
  charges,
}: {
  visitId: string;
  charges: VisitCharge[];
}) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [loading, setLoading] = useState(false);

  async function addCharge() {
    setLoading(true);
    await fetch(`/api/visits/${visitId}/charges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        quantity: 1,
        unitPrice: Number(unitPrice),
        sourceType: "manual",
      }),
    });
    setDescription("");
    setUnitPrice("");
    setLoading(false);
    router.refresh();
  }

  async function review(chargeId: string) {
    await fetch(`/api/charges/${chargeId}/review`, { method: "POST" });
    router.refresh();
  }

  async function createInvoice() {
    await fetch(`/api/visits/${visitId}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Created from reviewed visit charges" }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {charges.length === 0 ? (
          <li className="text-sm text-[var(--faint)]">אין חיובים לביקור.</li>
        ) : charges.map((charge) => (
          <li key={charge.id} className="flex items-center justify-between gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-3 text-sm">
            <div>
              <p className="font-semibold text-[var(--ink)]">{charge.description}</p>
              <p className="text-[var(--muted)]">₪{(charge.quantity * charge.unitPrice).toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color={charge.status === "pending" ? "amber" : charge.status === "reviewed" ? "green" : "muted"}>
                {charge.status}
              </Badge>
              {charge.status === "pending" ? (
                <Btn type="button" size="sm" variant="soft" onClick={() => void review(charge.id)}>
                  אשר חיוב
                </Btn>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 border-t border-[var(--line-2)] pt-3 sm:grid-cols-[1fr_140px_auto]">
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="תיאור חיוב"
          className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={unitPrice}
          onChange={(event) => setUnitPrice(event.target.value)}
          placeholder="מחיר"
          className="h-9 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
        />
        <Btn type="button" size="sm" loading={loading} disabled={!description.trim() || !unitPrice} onClick={() => void addCharge()}>
          הוסף
        </Btn>
      </div>
      {charges.some((charge) => charge.status === "reviewed") ? (
        <Btn type="button" size="sm" onClick={() => void createInvoice()}>
          צור חשבונית מהחיובים המאושרים
        </Btn>
      ) : null}
    </div>
  );
}
