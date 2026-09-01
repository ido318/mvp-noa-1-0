import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapMedicalNoteRow } from "@/lib/repositories/mappers";
import type {
  CreateMedicalNoteInput,
  MedicalNote,
  UpdateMedicalNoteInput,
} from "@/types/domain/medical-note";

/**
 * Detects the medical_notes_enforce_lock trigger's RAISE EXCEPTION (see
 * supabase/migrations/20260901172952_medical_notes_lock_and_addendum.sql),
 * so the repository can map it to a 409 conflict instead of the generic 502
 * that AppError.externalProvider() would otherwise produce.
 *
 * A plain `RAISE EXCEPTION` with no explicit SQLSTATE defaults to Postgres
 * code P0001, which the Supabase/PostgREST client surfaces on `error.code`
 * (the same field the codebase already branches on for PGRST116 elsewhere,
 * e.g. appointment.repository.ts's updateVersioned()). We also match on the
 * exception's exact message text as a second, independent signal in case the
 * code ever surfaces differently through a client upgrade.
 */
function isMedicalNoteLockError(error: unknown): boolean {
  const pgError = error as { code?: string; message?: string } | null | undefined;
  if (!pgError) return false;
  if (pgError.code === "P0001") return true;
  return typeof pgError.message === "string" && pgError.message.includes("medical note is locked");
}

export class MedicalNoteRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listByVisit(visitId: string): Promise<Result<MedicalNote[]>> {
    const { data, error } = await this.client
      .from("medical_notes")
      .select("*")
      .eq("visit_id", visitId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) return err(AppError.externalProvider("Failed to list medical notes", error));
    return ok((data ?? []).map(mapMedicalNoteRow));
  }

  async listByPet(clinicId: string, petId: string): Promise<Result<MedicalNote[]>> {
    const { data, error } = await this.client
      .from("medical_notes")
      .select("*, visit:visits!medical_notes_visit_clinic_fk(pet_id)")
      .eq("clinic_id", clinicId)
      .eq("visit.pet_id", petId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) return err(AppError.externalProvider("Failed to list pet medical notes", error));
    return ok((data ?? []).map(mapMedicalNoteRow));
  }

  async findById(noteId: string): Promise<Result<MedicalNote | null>> {
    const { data, error } = await this.client
      .from("medical_notes")
      .select("*")
      .eq("id", noteId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return err(AppError.externalProvider("Failed to load medical note", error));
    return ok(data ? mapMedicalNoteRow(data) : null);
  }

  async create(
    clinicId: string,
    visitId: string,
    input: CreateMedicalNoteInput,
    authorUserId: string,
  ): Promise<Result<MedicalNote>> {
    const { data, error } = await this.client
      .from("medical_notes")
      .insert({
        clinic_id: clinicId,
        visit_id: visitId,
        note_type: input.noteType,
        content: input.content,
        subjective: input.subjective ?? null,
        objective: input.objective ?? null,
        assessment: input.assessment ?? null,
        plan: input.plan ?? null,
        parent_note_id: input.parentNoteId ?? null,
        status: input.status ?? "draft",
        author_user_id: authorUserId,
      })
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to create medical note", error));
    return ok(mapMedicalNoteRow(data));
  }

  async update(noteId: string, input: UpdateMedicalNoteInput): Promise<Result<MedicalNote>> {
    const { data, error } = await this.client
      .from("medical_notes")
      .update({
        note_type: input.noteType,
        content: input.content,
        subjective: input.subjective,
        objective: input.objective,
        assessment: input.assessment,
        plan: input.plan,
        status: input.status,
      })
      .eq("id", noteId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) {
      // Defense-in-depth: the service layer pre-checks isMedicalNoteLocked()
      // before ever reaching here, but a time-of-check-to-time-of-use gap (or
      // a future direct-DB write bypassing the service layer) can still let
      // an update reach the medical_notes_enforce_lock trigger (see
      // supabase/migrations/20260901172952_medical_notes_lock_and_addendum.sql).
      // Surface that as a 409 conflict instead of a generic 502.
      if (isMedicalNoteLockError(error)) {
        return err(
          AppError.conflict(
            "Medical note is locked: it was approved more than 24 hours ago and can no longer be edited",
            error,
          ),
        );
      }
      return err(AppError.externalProvider("Failed to update medical note", error));
    }
    return ok(mapMedicalNoteRow(data));
  }

  async approve(noteId: string, approvedByUserId: string): Promise<Result<MedicalNote>> {
    const { data, error } = await this.client
      .from("medical_notes")
      .update({
        status: "approved",
        approved_by_user_id: approvedByUserId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", noteId)
      .eq("status", "draft")
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to approve medical note", error));
    return ok(mapMedicalNoteRow(data));
  }

  async softDelete(noteId: string): Promise<Result<MedicalNote>> {
    const { data, error } = await this.client
      .from("medical_notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", noteId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to delete medical note", error));
    return ok(mapMedicalNoteRow(data));
  }
}
