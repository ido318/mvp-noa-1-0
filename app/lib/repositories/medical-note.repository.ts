import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { mapMedicalNoteRow } from "@/lib/repositories/mappers";
import type {
  CreateMedicalNoteInput,
  MedicalNote,
  UpdateMedicalNoteInput,
} from "@/types/domain/medical-note";

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
      })
      .eq("id", noteId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) return err(AppError.externalProvider("Failed to update medical note", error));
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
