import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapInvoiceRow } from "@/lib/repositories/mappers";
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceListFilters,
} from "@/types/domain/invoice";

type InsertInvoiceInput = {
  clinicId: string;
  customerId: string;
  petId: string | null;
  invoiceNumber: string;
  items: InvoiceLineItem[];
  total: number;
  notes: string | null;
  createdByUserId: string;
};

const SELECT_WITH_JOINS = `
  *,
  customer:customers!invoices_customer_clinic_fk(full_name),
  pet:pets!invoices_pet_clinic_fk(name)
`;

export class InvoiceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filters: InvoiceListFilters): Promise<Result<Invoice[]>> {
    let query = this.client
      .from("invoices")
      .select(SELECT_WITH_JOINS)
      .in("clinic_id", filters.clinicIds)
      .is("deleted_at", null)
      .order("issued_at", { ascending: false });

    if (filters.customerId) query = query.eq("customer_id", filters.customerId);
    if (filters.petId) query = query.eq("pet_id", filters.petId);

    const { data, error } = await query;
    if (error) return err(AppError.externalProvider("Failed to list invoices", error));
    return ok((data ?? []).map(mapInvoiceRow));
  }

  async findById(invoiceId: string): Promise<Result<Invoice | null>> {
    const { data, error } = await this.client
      .from("invoices")
      .select(SELECT_WITH_JOINS)
      .eq("id", invoiceId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return err(AppError.externalProvider("Failed to load invoice", error));
    return ok(data ? mapInvoiceRow(data) : null);
  }

  async countForClinic(clinicId: string): Promise<Result<number>> {
    const { count, error } = await this.client
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId);

    if (error) return err(AppError.externalProvider("Failed to count invoices", error));
    return ok(count ?? 0);
  }

  async create(input: InsertInvoiceInput): Promise<Result<Invoice>> {
    const { data, error } = await this.client
      .from("invoices")
      .insert({
        clinic_id: input.clinicId,
        customer_id: input.customerId,
        pet_id: input.petId,
        invoice_number: input.invoiceNumber,
        items: input.items,
        total: input.total,
        notes: input.notes,
        created_by_user_id: input.createdByUserId,
      })
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) return err(AppError.externalProvider("Failed to create invoice", error));
    return ok(mapInvoiceRow(data));
  }

  async updateStatusVersioned(
    invoiceId: string,
    expectedVersion: number,
    status: string,
  ): Promise<Result<Invoice>> {
    const { data, error } = await this.client
      .from("invoices")
      .update({ status, version: expectedVersion + 1 })
      .eq("id", invoiceId)
      .eq("version", expectedVersion)
      .select(SELECT_WITH_JOINS)
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return err(
          AppError.conflict("Invoice update conflict: stale version", {
            invoiceId,
            expectedVersion,
          }),
        );
      }
      return err(AppError.externalProvider("Failed to update invoice status", error));
    }
    return ok(mapInvoiceRow(data));
  }
}
