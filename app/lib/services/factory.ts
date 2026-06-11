import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AIEventRepository } from "@/lib/repositories/ai-event.repository";
import { AppointmentRepository } from "@/lib/repositories/appointment.repository";
import { AuditLogRepository } from "@/lib/repositories/audit-log.repository";
import { ClinicRepository } from "@/lib/repositories/clinic.repository";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { MedicalNoteRepository } from "@/lib/repositories/medical-note.repository";
import { PetRepository } from "@/lib/repositories/pet.repository";
import { PrescriptionRepository } from "@/lib/repositories/prescription.repository";
import { ProfileRepository } from "@/lib/repositories/profile.repository";
import { VaccinationRepository } from "@/lib/repositories/vaccination.repository";
import { VisitRepository } from "@/lib/repositories/visit.repository";
import { AIEventService } from "@/lib/services/ai-event.service";
import { AppointmentService } from "@/lib/services/appointment.service";
import { AuditService } from "@/lib/services/audit.service";
import { AuthService } from "@/lib/services/auth.service";
import { CalendarService } from "@/lib/services/calendar.service";
import { CustomerService } from "@/lib/services/customer.service";
import { HealthService } from "@/lib/services/health.service";
import { MedicalRecordService } from "@/lib/services/medical-record.service";
import { PetService } from "@/lib/services/pet.service";
import { VisitService } from "@/lib/services/visit.service";
import { VisitSummaryAssistantService } from "@/lib/services/visit-summary-assistant.service";
import { VoiceCallService } from "@/lib/services/voice-call.service";
import { VoiceCallRepository } from "@/lib/repositories/voice-call.repository";
import { EscalationService } from "@/lib/services/escalation.service";
import { DashboardNotificationsService } from "@/lib/services/dashboard-notifications.service";

export async function createServices() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  const profileRepository = new ProfileRepository(supabase);
  const clinicRepository = new ClinicRepository(supabase);
  const customerRepository = new CustomerRepository(supabase);
  const petRepository = new PetRepository(supabase);
  const appointmentRepository = new AppointmentRepository(supabase);
  const visitRepository = new VisitRepository(supabase);
  const voiceCallRepository = new VoiceCallRepository(supabase);
  const medicalNoteRepository = new MedicalNoteRepository(supabase);
  const vaccinationRepository = new VaccinationRepository(supabase);
  const prescriptionRepository = new PrescriptionRepository(supabase);
  const auditLogRepository = new AuditLogRepository(admin);
  const aiEventRepository = new AIEventRepository(admin);
  const auditService = new AuditService(auditLogRepository);

  return {
    auth: new AuthService(supabase, profileRepository, clinicRepository),
    health: new HealthService(admin),
    audit: auditService,
    aiEvent: new AIEventService(aiEventRepository),
    customer: new CustomerService(customerRepository, petRepository, auditService),
    pet: new PetService(petRepository, customerRepository, auditService),
    escalation: new EscalationService(supabase),
    dashboardNotifications: new DashboardNotificationsService(supabase),
    appointment: new AppointmentService(
      appointmentRepository,
      customerRepository,
      petRepository,
      auditService,
      new DashboardNotificationsService(supabase),
    ),
    calendar: new CalendarService(appointmentRepository),
    visit: new VisitService(
      visitRepository,
      customerRepository,
      petRepository,
      appointmentRepository,
      auditService,
    ),
    medicalRecord: new MedicalRecordService(
      visitRepository,
      medicalNoteRepository,
      vaccinationRepository,
      prescriptionRepository,
      petRepository,
      auditService,
    ),
    visitSummaryAssistant: new VisitSummaryAssistantService(
      visitRepository,
      medicalNoteRepository,
      prescriptionRepository,
      petRepository,
      auditService,
      new AIEventService(aiEventRepository),
    ),
    voiceCall: new VoiceCallService(voiceCallRepository),
  };
}

export function createAdminServices() {
  const admin = createSupabaseAdminClient();
  return {
    audit: new AuditService(new AuditLogRepository(admin)),
    aiEvent: new AIEventService(new AIEventRepository(admin)),
    health: new HealthService(admin),
  };
}
