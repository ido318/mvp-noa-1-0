import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import type { ServiceActor } from "@/lib/services/service-context";
import type { ClinicRole } from "@/types/domain/clinic";

const MEDICAL_DELETE_ROLES: ClinicRole[] = ["owner", "admin", "veterinarian"];

export function assertVisitSummaryAiAuthorized(
  actor: ServiceActor,
  clinicId: string,
): Result<void> {
  return assertMedicalDeleteAuthorized(actor, clinicId);
}

export function assertMedicalDeleteAuthorized(
  actor: ServiceActor,
  clinicId: string,
): Result<void> {
  const membership = actor.memberships.find((item) => item.clinicId === clinicId);
  if (!membership) {
    return err(AppError.forbidden("No clinic membership for medical delete"));
  }
  if (!MEDICAL_DELETE_ROLES.includes(membership.role)) {
    return err(
      AppError.forbidden(
        "Elevated clinic role required to delete medical records (owner, admin, or veterinarian)",
      ),
    );
  }
  return ok(undefined);
}
