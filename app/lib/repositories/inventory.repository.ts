import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapInventoryItemRow } from "@/lib/repositories/mappers";
import type {
  CreateInventoryItemInput,
  InventoryAdjustmentInput,
  InventoryItem,
} from "@/types/domain/inventory";

export class InventoryRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(clinicIds: string[]): Promise<Result<InventoryItem[]>> {
    const { data, error } = await this.client
      .from("inventory_items")
      .select("*")
      .in("clinic_id", clinicIds)
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (error) return err(AppError.externalProvider("Failed to list inventory", error));
    return ok((data ?? []).map(mapInventoryItemRow));
  }

  async create(input: CreateInventoryItemInput & { createdByUserId: string }): Promise<Result<InventoryItem>> {
    const { data, error } = await this.client
      .from("inventory_items")
      .insert({
        clinic_id: input.clinicId,
        name: input.name,
        sku: input.sku ?? null,
        category: input.category ?? "general",
        unit: input.unit ?? "unit",
        quantity_on_hand: input.quantityOnHand ?? 0,
        reorder_level: input.reorderLevel ?? 0,
        unit_cost: input.unitCost ?? null,
        unit_price: input.unitPrice ?? null,
        created_by_user_id: input.createdByUserId,
      })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to create inventory item", error));
    return ok(mapInventoryItemRow(data));
  }

  async adjust(
    itemId: string,
    input: InventoryAdjustmentInput & { clinicId: string; createdByUserId: string },
  ): Promise<Result<InventoryItem>> {
    const { data: existing, error: loadError } = await this.client
      .from("inventory_items")
      .select("*")
      .eq("id", itemId)
      .eq("clinic_id", input.clinicId)
      .is("deleted_at", null)
      .single();
    if (loadError) return err(AppError.externalProvider("Failed to load inventory item", loadError));

    const current = Number(existing.quantity_on_hand);
    const next = current + input.quantityDelta;
    if (next < 0) return err(AppError.validation("Inventory adjustment cannot make stock negative"));

    const { data, error } = await this.client
      .from("inventory_items")
      .update({ quantity_on_hand: next, version: Number(existing.version) + 1 })
      .eq("id", itemId)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to adjust inventory item", error));

    const { error: txError } = await this.client.from("inventory_transactions").insert({
      clinic_id: input.clinicId,
      item_id: itemId,
      transaction_type: input.transactionType ?? "adjustment",
      quantity_delta: input.quantityDelta,
      reason: input.reason,
      source_type: input.sourceType ?? "manual",
      source_id: input.sourceId ?? null,
      created_by_user_id: input.createdByUserId,
    });
    if (txError) return err(AppError.externalProvider("Failed to record inventory transaction", txError));

    return ok(mapInventoryItemRow(data));
  }
}
