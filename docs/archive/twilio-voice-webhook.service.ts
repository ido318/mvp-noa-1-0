import { AppError, err, ok, type Result } from "@/lib/errors/app-error";
import { getTwilioVoiceConfig } from "@/lib/integrations/twilio/config";
import { normalizePhoneNumber } from "@/lib/integrations/twilio/phone";
import {
  mapTwilioCallStatus,
  sanitizeTwilioMetadata,
} from "@/lib/integrations/twilio/signature";
import {
  buildInitialInboundTwiml,
  buildMenuResponseTwiml,
} from "@/lib/integrations/twilio/twiml";
import type { CustomerRepository } from "@/lib/repositories/customer.repository";
import type { VoiceCallRepository } from "@/lib/repositories/voice-call.repository";
import type { AIEventService } from "@/lib/services/ai-event.service";
import type { AuditService } from "@/lib/services/audit.service";
import type { VoiceCall } from "@/types/domain/voice-call";
import type { TwilioVoiceWebhookParams } from "@/lib/validators/voice-call";

export type TwilioInboundResult = {
  twiml: string;
  call?: VoiceCall;
};

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "busy",
  "no_answer",
  "canceled",
]);

export class TwilioVoiceWebhookService {
  constructor(
    private readonly voiceCallRepository: VoiceCallRepository,
    private readonly customerRepository: CustomerRepository,
    private readonly auditService: AuditService,
    private readonly aiEventService: AIEventService,
  ) {}

  async handleInbound(params: TwilioVoiceWebhookParams): Promise<Result<TwilioInboundResult>> {
    const config = getTwilioVoiceConfig();
    if (!config) {
      return err(AppError.internal("Twilio voice is not configured"));
    }

    if (params.Digits) {
      await this.recordMenuSelection(params, config.clinicId);
      return ok({ twiml: buildMenuResponseTwiml(params.Digits) });
    }

    const prior = await this.voiceCallRepository.findByTwilioCallSid(params.CallSid);

    const customer = await this.customerRepository.findByClinicAndPhone(
      config.clinicId,
      params.From,
    );
    if (!customer.ok) return err(customer.error);

    const metadata = sanitizeTwilioMetadata(params as unknown as Record<string, string>);
    const upsert = await this.voiceCallRepository.upsertInbound({
      clinicId: config.clinicId,
      customerId: customer.value?.id ?? null,
      fromNumber: normalizePhoneNumber(params.From),
      toNumber: normalizePhoneNumber(params.To),
      twilioCallSid: params.CallSid,
      twilioParentCallSid: params.ParentCallSid ?? null,
      status: mapTwilioCallStatus(params.CallStatus),
      metadata,
    });
    if (!upsert.ok) return err(upsert.error);

    const isNew = !prior.ok || !prior.value;
    if (isNew) {
      await this.auditService.logAction({
        clinicId: config.clinicId,
        actorType: "system",
        actorId: "twilio-voice",
        action: "voice_call.inbound_received",
        entityType: "voice_call",
        entityId: upsert.value.id,
        afterPayload: {
          twilioCallSid: upsert.value.twilioCallSid,
          status: upsert.value.status,
          customerMatched: Boolean(customer.value),
        },
        metadata: { direction: "inbound" },
      });

      await this.aiEventService.logEvent({
        clinicId: config.clinicId,
        sourceType: "voice_call",
        sourceId: upsert.value.id,
        agentName: "twilio-voice-mvp",
        eventType: "inbound_call_received",
        inputPayload: {
          twilioCallSid: upsert.value.twilioCallSid,
          callStatus: params.CallStatus ?? null,
        },
        outputPayload: {
          customerMatched: Boolean(customer.value),
          menu: "hebrew_dtmf_mvp",
        },
        metadata: { phase: 6 },
      });
    }

    return ok({ twiml: buildInitialInboundTwiml(), call: upsert.value });
  }

  async handleStatus(params: TwilioVoiceWebhookParams): Promise<Result<VoiceCall>> {
    const config = getTwilioVoiceConfig();
    if (!config) {
      return err(AppError.internal("Twilio voice is not configured"));
    }

    const existing = await this.voiceCallRepository.findByTwilioCallSid(params.CallSid);
    if (!existing.ok) return err(existing.error);
    if (!existing.value) {
      return err(AppError.notFound("Voice call not found for status callback"));
    }

    const status = mapTwilioCallStatus(params.CallStatus);
    const durationSeconds = params.CallDuration
      ? Number.parseInt(params.CallDuration, 10)
      : undefined;
    const endedAt = TERMINAL_STATUSES.has(status) ? new Date().toISOString() : undefined;
    const metadata = {
      ...existing.value.metadata,
      ...sanitizeTwilioMetadata(params as unknown as Record<string, string>),
    };

    const updated = await this.voiceCallRepository.updateStatusByTwilioSid(params.CallSid, {
      status,
      endedAt: endedAt ?? null,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds! : undefined,
      recordingUrl:
        params.RecordingUrl?.startsWith("http") ? params.RecordingUrl : undefined,
      metadata,
    });
    if (!updated.ok) return err(updated.error);

    if (existing.value.status !== status) {
      await this.auditService.logAction({
        clinicId: existing.value.clinicId,
        actorType: "system",
        actorId: "twilio-voice",
        action: "voice_call.status_updated",
        entityType: "voice_call",
        entityId: existing.value.id,
        beforePayload: { status: existing.value.status },
        afterPayload: {
          status: updated.value.status,
          durationSeconds: updated.value.durationSeconds,
          hasRecording: Boolean(updated.value.recordingUrl),
        },
        metadata: { twilioCallSid: params.CallSid },
      });
    }

    if (TERMINAL_STATUSES.has(status) && !TERMINAL_STATUSES.has(existing.value.status)) {
      await this.aiEventService.logEvent({
        clinicId: existing.value.clinicId,
        sourceType: "voice_call",
        sourceId: existing.value.id,
        agentName: "twilio-voice-mvp",
        eventType: "call_status_terminal",
        inputPayload: {
          twilioCallSid: params.CallSid,
          callStatus: params.CallStatus ?? null,
        },
        outputPayload: {
          status: updated.value.status,
          durationSeconds: updated.value.durationSeconds,
        },
        metadata: { phase: 6 },
      });
    }

    return ok(updated.value);
  }

  private async recordMenuSelection(
    params: TwilioVoiceWebhookParams,
    clinicId: string,
  ): Promise<void> {
    const existing = await this.voiceCallRepository.findByTwilioCallSid(params.CallSid);
    if (!existing.ok || !existing.value) return;

    const metadata = {
      ...existing.value.metadata,
      lastMenuDigit: params.Digits ?? null,
    };
    await this.voiceCallRepository.updateStatusByTwilioSid(params.CallSid, {
      status: existing.value.status,
      metadata,
    });

    await this.aiEventService.logEvent({
      clinicId,
      sourceType: "voice_call",
      sourceId: existing.value.id,
      agentName: "twilio-voice-mvp",
      eventType: "dtmf_menu_selection",
      inputPayload: { twilioCallSid: params.CallSid },
      outputPayload: { digit: params.Digits ?? null },
      metadata: { phase: 6 },
    });
  }
}
