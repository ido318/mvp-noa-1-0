"use client";

import { useState } from "react";
import { Btn } from "@/components/dashboard/ui/btn";
import type { InventoryItem } from "@/types/domain/inventory";

export function StockAdjustModal({
  item,
  onAdjusted,
}: {
  item: InventoryItem;
  onAdjusted: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function adjust(type: "restock" | "adjustment") {
    setLoading(true);
    await fetch(`/api/inventory/${item.id}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinicId: item.clinicId,
        transactionType: type,
        quantityDelta: Number(quantity),
        reason: reason.trim() || null,
      }),
    });
    setQuantity("");
    setReason("");
    setLoading(false);
    onAdjusted();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        placeholder="שינוי"
        className="h-8 w-20 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-2 text-xs text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
      />
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="סיבה"
        className="h-8 w-32 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-2 text-xs text-[var(--ink)] outline-none focus:border-[var(--brand-400)]"
      />
      <Btn type="button" size="sm" variant="soft" loading={loading} disabled={!quantity} onClick={() => void adjust("adjustment")}>
        עדכן
      </Btn>
    </div>
  );
}
