import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapVisitChargeRow } from "@/lib/repositories/mappers";
import type { CreateVisitChargeInput, VisitCharge } from "@/types/domain/visit-charge";

export class VisitChargeRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByVisit(visitId: string): Promise<Result<VisitCharge[]>> {
    const { data, error } = await this.client
      .from("visit_charges")
      .select("*")
      .eq("visit_id", visitId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) return err(AppError.externalProvider("Failed to list visit charges", error));
    return ok((data ?? []).map(mapVisitChargeRow));
  }

  async create(input: CreateVisitChargeInput & {
    clinicId: string;
    visitId: string;
    customerId: string;
    petId: string;
    createdByUserId: string;
  }): Promise<Result<VisitCharge>> {
    const { data, error } = await this.client
      .from("visit_charges")
      .insert({
        clinic_id: input.clinicId,
        visit_id: input.visitId,
        customer_id: input.customerId,
        pet_id: input.petId,
        description: input.description,
        quantity: input.quantity,
        unit_price: input.unitPrice,
        source_type: input.sourceType ?? "manual",
        source_id: input.sourceId ?? null,
        created_by_user_id: input.createdByUserId,
      })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to create visit charge", error));
    return ok(mapVisitChargeRow(data));
  }

  async review(chargeId: string, reviewerUserId: string, clinicIds: string[]): Promise<Result<VisitCharge>> {
    const { data, error } = await this.client
      .from("visit_charges")
      .update({
        status: "reviewed",
        reviewed_by_user_id: reviewerUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", chargeId)
      .in("clinic_id", clinicIds)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to review visit charge", error));
    return ok(mapVisitChargeRow(data));
  }

  async markInvoiced(chargeIds: string[], invoiceId: string): Promise<Result<void>> {
    const { error } = await this.client
      .from("visit_charges")
      .update({ status: "invoiced", invoice_id: invoiceId })
      .in("id", chargeIds);
    if (error) return err(AppError.externalProvider("Failed to mark charges invoiced", error));
    return ok(undefined);
  }
}
