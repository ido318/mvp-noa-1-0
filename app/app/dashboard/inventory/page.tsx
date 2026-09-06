"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/dashboard/ui/card";
import { Btn } from "@/components/dashboard/ui/btn";
import { Field, Input } from "@/components/dashboard/ui/field";
import { EmptyState } from "@/components/dashboard/ui/empty-state";
import { SkeletonRow } from "@/components/dashboard/ui/skeleton";
import { PackageIcon } from "@/components/dashboard/icons";
import { InventoryTable } from "@/components/dashboard/inventory/inventory-table";
import { StockAdjustModal } from "@/components/dashboard/inventory/stock-adjust-modal";
import type { InventoryItem } from "@/types/domain/inventory";
import type { MeResponse } from "@/types/api/me";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
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
      <h1 className="text-[28px] font-semibold" style={{ color: "var(--text-primary)" }}>מלאי</h1>
      <Card>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <Field label="שם פריט" htmlFor="newInventoryItemName">
            <Input
              id="newInventoryItemName"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="כמות" htmlFor="newInventoryItemQuantity">
            <Input
              id="newInventoryItemQuantity"
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Btn type="button" disabled={!name.trim()} onClick={() => void createItem()}>הוסף פריט</Btn>
        </div>
      </Card>
      {loading ? (
        <Card noPad>
          <div className="divide-y divide-[var(--border-row)]">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<PackageIcon size={32} />}
          title="אין פריטי מלאי עדיין"
          subtitle="פריטים שתוסיפו יופיעו כאן עם מצב המלאי שלהם"
        />
      ) : (
        <>
          <InventoryTable items={items} />
          <Card noPad>
            <div className="divide-y divide-[var(--border-row)]">
              {items.map((item) => (
                <div key={`${item.id}-adjust`} className="px-4 py-3">
                  <StockAdjustModal item={item} onAdjusted={() => void load()} />
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
