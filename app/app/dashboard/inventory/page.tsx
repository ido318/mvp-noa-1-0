"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Btn } from "@/components/dashboard/ui/btn";
import { InventoryTable } from "@/components/dashboard/inventory/inventory-table";
import { StockAdjustModal } from "@/components/dashboard/inventory/stock-adjust-modal";
import type { InventoryItem } from "@/types/domain/inventory";
import type { MeResponse } from "@/types/api/me";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");

  async function load() {
    const res = await fetch("/api/inventory");
    if (res.ok) {
      const data = await res.json() as { data: { items: InventoryItem[] } };
      setItems(data.data.items);
    }
  }

  useEffect(() => {
    void (async () => {
      const meRes = await fetch("/api/me");
      if (meRes.ok) {
        const me = await meRes.json() as { data: MeResponse };
        setClinicId(me.data.profile.defaultClinicId ?? me.data.memberships[0]?.clinicId ?? null);
      }
      await load();
    })();
  }, []);

  async function createItem() {
    if (!clinicId) return;
    await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId, name, quantityOnHand: Number(quantity || 0) }),
    });
    setName("");
    setQuantity("");
    await load();
  }

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-5 p-6">
      <h1 className="text-[28px] font-extrabold text-[var(--ink)]">מלאי</h1>
      <Card>
        <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="שם פריט" className="h-10 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm" />
          <input type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="כמות" className="h-10 rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--bg)] px-3 text-sm" />
          <Btn type="button" disabled={!name.trim()} onClick={() => void createItem()}>הוסף פריט</Btn>
        </div>
      </Card>
      <Card noPad>
        <InventoryTable items={items} />
        <div className="divide-y divide-[var(--line-2)] border-t border-[var(--line-2)]">
          {items.map((item) => (
            <div key={`${item.id}-adjust`} className="px-4 py-3">
              <StockAdjustModal item={item} onAdjusted={() => void load()} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
