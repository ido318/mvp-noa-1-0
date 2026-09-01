import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { InvoiceService } from "@/lib/services/invoice.service";
import type { VisitChargeRepository } from "@/lib/repositories/visit-charge.repository";
import type { VisitRepository } from "@/lib/repositories/visit.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { CreateVisitChargeInput, VisitCharge } from "@/types/domain/visit-charge";
import type { Invoice } from "@/types/domain/invoice";
import type { Visit } from "@/types/domain/visit";

export class VisitChargeService {
  constructor(
    private readonly repository: VisitChargeRepository,
    private readonly visitRepository: VisitRepository,
    private readonly invoiceService: InvoiceService,
  ) {}

  async listForVisit(actor: ServiceActor, visitId: string): Promise<Result<VisitCharge[]>> {
    const visit = await this.loadVisit(actor, visitId);
    if (!visit.ok) return err(visit.error);
    return this.repository.listByVisit(visitId);
  }

  async createForVisit(
    actor: ServiceActor,
    visitId: string,
    input: CreateVisitChargeInput,
  ): Promise<Result<VisitCharge>> {
    const visit = await this.loadVisit(actor, visitId);
    if (!visit.ok) return err(visit.error);
    return this.repository.create({
      ...input,
      clinicId: visit.value.clinicId,
      visitId,
      customerId: visit.value.customerId,
      petId: visit.value.petId,
      createdByUserId: actor.userId,
    });
  }

  async reviewCharge(actor: ServiceActor, chargeId: string): Promise<Result<VisitCharge>> {
    return this.repository.review(chargeId, actor.userId, actor.clinicIds);
  }

  async createInvoiceFromVisit(
    actor: ServiceActor,
    visitId: string,
    input: { notes?: string | null },
  ): Promise<Result<Invoice>> {
    const visit = await this.loadVisit(actor, visitId);
    if (!visit.ok) return err(visit.error);
    const charges = await this.repository.listByVisit(visitId);
    if (!charges.ok) return err(charges.error);
    const reviewed = charges.value.filter((charge) => charge.status === "reviewed");
    if (reviewed.length === 0) {
      return err(AppError.validation("At least one reviewed charge is required before invoice creation"));
    }
    if (charges.value.some((charge) => charge.status === "pending")) {
      return err(AppError.validation("All pending charges must be reviewed before invoice creation"));
    }

    const invoice = await this.invoiceService.createInvoice(actor, {
      clinicId: visit.value.clinicId,
      customerId: visit.value.customerId,
      petId: visit.value.petId,
      items: reviewed.map((charge) => ({
        description: charge.description,
        quantity: charge.quantity,
        unitPrice: charge.unitPrice,
      })),
      notes: input.notes ?? null,
    });
    if (!invoice.ok) return invoice;

    const marked = await this.repository.markInvoiced(reviewed.map((charge) => charge.id), invoice.value.id);
    if (!marked.ok) return err(marked.error);
    return ok(invoice.value);
  }

  private async loadVisit(actor: ServiceActor, visitId: string): Promise<Result<Visit>> {
    const visit = await this.visitRepository.findById(visitId);
    if (!visit.ok) return visit;
    if (!visit.value) return err(AppError.notFound("Visit not found"));
    if (!actor.clinicIds.includes(visit.value.clinicId)) {
      return err(AppError.forbidden("Visit outside actor clinics"));
    }
    return ok(visit.value);
  }
}
