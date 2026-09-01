import { AppError, err, type Result } from "@/lib/errors/app-error";
import type { PaymentRepository } from "@/lib/repositories/payment.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { Payment, RecordPaymentInput } from "@/types/domain/payment";

export class PaymentService {
  constructor(private readonly repository: PaymentRepository) {}

  async recordPayment(actor: ServiceActor, input: RecordPaymentInput): Promise<Result<Payment>> {
    if (!actor.clinicIds.includes(input.clinicId)) {
      return err(AppError.forbidden("Cannot record payment for requested clinic"));
    }
    return this.repository.record({ ...input, recordedByUserId: actor.userId });
  }
}
