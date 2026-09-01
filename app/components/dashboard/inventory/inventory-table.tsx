"use client";

import { Badge } from "@/components/dashboard/ui/badge";
import type { InventoryItem } from "@/types/domain/inventory";

export function InventoryTable({ items }: { items: InventoryItem[] }) {
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-[var(--line-2)]">
        {items.map((item) => (
          <tr key={item.id}>
            <td className="px-4 py-3 font-semibold text-[var(--ink)]">{item.name}</td>
            <td className="px-4 py-3 text-[var(--ink-2)]">
              {item.quantityOnHand} {item.unit}
            </td>
            <td className="px-4 py-3">
              {item.quantityOnHand <= item.reorderLevel ? (
                <Badge color="amber">מלאי נמוך</Badge>
              ) : (
                <Badge color="green">תקין</Badge>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
