import type { AIEvent } from "@/types/domain/ai-event";
import type {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
  AppointmentType,
} from "@/types/domain/appointment";
import type { AuditLog } from "@/types/domain/audit-log";
import type { Clinic, ClinicMembership, ClinicRole } from "@/types/domain/clinic";
import type {
  Customer,
  CustomerStatus,
  PreferredContactMethod,
} from "@/types/domain/customer";
import type { MedicalNote, MedicalNoteType } from "@/types/domain/medical-note";
import type { Pet, PetStatus } from "@/types/domain/pet";
import type { Prescription, PrescriptionStatus } from "@/types/domain/prescription";
import type { Profile } from "@/types/domain/profile";
import type { Vaccination } from "@/types/domain/vaccination";
import type { Visit, VisitStatus } from "@/types/domain/visit";
import type {
  VoiceCall,
  VoiceCallDirection,
  VoiceCallStatus,
} from "@/types/domain/voice-call";

export function mapProfileRow(row: {
  id: string;
  full_name: string | null;
  phone: string | null;
  default_clinic_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    defaultClinicId: row.default_clinic_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapClinicRow(row: {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Clinic {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapMembershipRow(row: {
  id: string;
  clinic_id: string;
  user_id: string;
  role: ClinicRole;
  created_at: string;
  updated_at: string;
}): ClinicMembership {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAuditLogRow(row: {
  id: string;
  clinic_id: string | null;
  actor_type: AuditLog["actorType"];
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_payload: Record<string, unknown> | null;
  after_payload: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}): AuditLog {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    beforePayload: row.before_payload,
    afterPayload: row.after_payload,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function mapAIEventRow(row: {
  id: string;
  clinic_id: string;
  source_type: string;
  source_id: string | null;
  agent_name: string;
  event_type: string;
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  confidence: number | null;
  model_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}): AIEvent {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    agentName: row.agent_name,
    eventType: row.event_type,
    inputPayload: row.input_payload,
    outputPayload: row.output_payload,
    confidence: row.confidence,
    modelName: row.model_name,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function mapCustomerRow(row: {
  id: string;
  clinic_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  preferred_contact_method: PreferredContactMethod;
  notes: string | null;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Customer {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    preferredContactMethod: row.preferred_contact_method,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapPetRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  weight: number | null;
  chip_number: string | null;
  is_neutered: boolean;
  allergies: string | null;
  chronic_conditions: string | null;
  current_medications: string | null;
  notes: string | null;
  profile_image_url: string | null;
  status: PetStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Pet {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    sex: row.sex,
    birthDate: row.birth_date,
    weight: row.weight,
    chipNumber: row.chip_number,
    isNeutered: row.is_neutered,
    allergies: row.allergies,
    chronicConditions: row.chronic_conditions,
    currentMedications: row.current_medications,
    notes: row.notes,
    profileImageUrl: row.profile_image_url,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapAppointmentRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  pet_id: string;
  appointment_type: AppointmentType;
  status: AppointmentStatus;
  source: AppointmentSource;
  scheduled_at: string;
  duration_minutes: number;
  reason: string | null;
  notes: string | null;
  version: number;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Appointment {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    petId: row.pet_id,
    appointmentType: row.appointment_type,
    status: row.status,
    source: row.source,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    reason: row.reason,
    notes: row.notes,
    version: row.version,
    cancelledAt: row.cancelled_at,
    cancelledByUserId: row.cancelled_by_user_id,
    cancellationReason: row.cancellation_reason,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapVisitRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string;
  pet_id: string;
  appointment_id: string | null;
  status: VisitStatus;
  chief_complaint: string | null;
  manual_visit_summary: string | null;
  ai_visit_summary: string | null;
  ai_summary_generated_at: string | null;
  ai_summary_accepted_by_user_id: string | null;
  started_at: string;
  completed_at: string | null;
  version: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Visit {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    petId: row.pet_id,
    appointmentId: row.appointment_id,
    status: row.status,
    chiefComplaint: row.chief_complaint,
    manualVisitSummary: row.manual_visit_summary,
    aiVisitSummary: row.ai_visit_summary,
    aiSummaryGeneratedAt: row.ai_summary_generated_at,
    aiSummaryAcceptedByUserId: row.ai_summary_accepted_by_user_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    version: row.version,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapMedicalNoteRow(row: {
  id: string;
  clinic_id: string;
  visit_id: string;
  note_type: MedicalNoteType;
  content: string;
  author_user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): MedicalNote {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    visitId: row.visit_id,
    noteType: row.note_type,
    content: row.content,
    authorUserId: row.author_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapVaccinationRow(row: {
  id: string;
  clinic_id: string;
  pet_id: string;
  customer_id: string;
  visit_id: string | null;
  vaccine_name: string;
  administered_at: string;
  batch_number: string | null;
  next_due_at: string | null;
  notes: string | null;
  administered_by_user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Vaccination {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    petId: row.pet_id,
    customerId: row.customer_id,
    visitId: row.visit_id,
    vaccineName: row.vaccine_name,
    administeredAt: row.administered_at,
    batchNumber: row.batch_number,
    nextDueAt: row.next_due_at,
    notes: row.notes,
    administeredByUserId: row.administered_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapVoiceCallRow(row: {
  id: string;
  clinic_id: string;
  customer_id: string | null;
  direction: VoiceCallDirection;
  status: VoiceCallStatus;
  from_number: string;
  to_number: string;
  twilio_call_sid: string;
  twilio_parent_call_sid: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}): VoiceCall {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    customerId: row.customer_id,
    direction: row.direction,
    status: row.status,
    fromNumber: row.from_number,
    toNumber: row.to_number,
    twilioCallSid: row.twilio_call_sid,
    twilioParentCallSid: row.twilio_parent_call_sid,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    recordingUrl: row.recording_url,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPrescriptionRow(row: {
  id: string;
  clinic_id: string;
  visit_id: string;
  pet_id: string;
  medication_name: string;
  instructions: string;
  status: PrescriptionStatus;
  discontinued_at: string | null;
  prescribed_at: string;
  prescribed_by_user_id: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): Prescription {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    visitId: row.visit_id,
    petId: row.pet_id,
    medicationName: row.medication_name,
    instructions: row.instructions,
    status: row.status,
    discontinuedAt: row.discontinued_at,
    prescribedAt: row.prescribed_at,
    prescribedByUserId: row.prescribed_by_user_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
