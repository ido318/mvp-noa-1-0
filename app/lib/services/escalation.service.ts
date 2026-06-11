import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, type Result } from "@/lib/errors/app-error";
import { EscalationRepository } from "@/lib/repositories/escalation.repository";
import type { Escalation, EscalationListFilters, ResolveEscalationInput } from "@/types/domain/escalation";

export class EscalationService {
  private readonly repo: EscalationRepository;

  constructor(client: SupabaseClient) {
    this.repo = new EscalationRepository(client);
  }

  async listForClinics(clinicIds: string[], status?: "open" | "resolved"): Promise<Result<Escalation[]>> {
    return this.repo.list({ clinicIds, status });
  }

  async countOpen(clinicIds: string[]): Promise<Result<number>> {
    return this.repo.countOpen(clinicIds);
  }

  async resolve(id: string, notes: string | undefined, actorUserId: string): Promise<Result<Escalation>> {
    return this.repo.resolve(id, { notes, resolvedByUserId: actorUserId });
  }
}
