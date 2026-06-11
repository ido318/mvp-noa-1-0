import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AIEventRepository } from "@/lib/repositories/ai-event.repository";
import { AuditLogRepository } from "@/lib/repositories/audit-log.repository";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { VoiceCallRepository } from "@/lib/repositories/voice-call.repository";
import { AIEventService } from "@/lib/services/ai-event.service";
import { AuditService } from "@/lib/services/audit.service";
import { TwilioVoiceWebhookService } from "@/lib/services/twilio-voice-webhook.service";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true" &&
  Boolean(supabaseUrl && serviceRoleKey);

const clinic1 = "00000000-0000-4000-8000-000000000001";

describe.runIf(runIntegration)("phase6 voice calls", () => {
  let adminClient: ReturnType<typeof createClient>;
  let webhookService: TwilioVoiceWebhookService;
  const createdCustomerIds: string[] = [];
  const createdCallSids: string[] = [];

  beforeAll(async () => {
    process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "AC_test";
    process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "test-token";
    process.env.TWILIO_CLINIC_PHONE_NUMBER =
      process.env.TWILIO_CLINIC_PHONE_NUMBER ?? "+972359012345";
    process.env.APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

    adminClient = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const auditService = new AuditService(new AuditLogRepository(adminClient));
    const aiEventService = new AIEventService(new AIEventRepository(adminClient));
    webhookService = new TwilioVoiceWebhookService(
      new VoiceCallRepository(adminClient),
      new CustomerRepository(adminClient),
      auditService,
      aiEventService,
    );
  });

  afterAll(async () => {
    if (createdCallSids.length) {
      await adminClient.from("voice_calls").delete().in("twilio_call_sid", createdCallSids);
    }
    if (createdCustomerIds.length) {
      await adminClient.from("customers").delete().in("id", createdCustomerIds);
    }
  });

  it("upserts inbound call and matches customer by phone", async () => {
    const phone = "+972501112233";
    const { data: customer, error } = await adminClient
      .from("customers")
      .insert({
        clinic_id: clinic1,
        full_name: "Phase6 Caller",
        phone,
        preferred_contact_method: "phone",
        status: "active",
      })
      .select("*")
      .single();
    expect(error).toBeNull();
    createdCustomerIds.push(customer!.id);

    const callSid = `CA-phase6-${Date.now()}`;
    createdCallSids.push(callSid);

    const inbound = await webhookService.handleInbound({
      CallSid: callSid,
      From: phone,
      To: process.env.TWILIO_CLINIC_PHONE_NUMBER!,
      CallStatus: "ringing",
    });
    expect(inbound.ok).toBe(true);
    expect(inbound.value?.twiml).toContain("<Gather");
    expect(inbound.value?.call?.customerId).toBe(customer!.id);

    const status = await webhookService.handleStatus({
      CallSid: callSid,
      From: phone,
      To: process.env.TWILIO_CLINIC_PHONE_NUMBER!,
      CallStatus: "completed",
      CallDuration: "42",
    });
    expect(status.ok).toBe(true);
    expect(status.value?.status).toBe("completed");
    expect(status.value?.durationSeconds).toBe(42);

    const { data: auditRows } = await adminClient
      .from("audit_logs")
      .select("*")
      .eq("entity_type", "voice_call")
      .eq("entity_id", inbound.value!.call!.id);
    expect((auditRows ?? []).length).toBeGreaterThan(0);

    const { data: aiRows } = await adminClient
      .from("ai_events")
      .select("*")
      .eq("source_type", "voice_call")
      .eq("source_id", inbound.value!.call!.id);
    expect((aiRows ?? []).length).toBeGreaterThan(0);
    for (const row of aiRows ?? []) {
      const serialized = JSON.stringify(row);
      expect(serialized).not.toContain("Phase6 Caller");
      expect(row.output_payload).not.toHaveProperty("transcript");
    }
  });

  it("is idempotent on repeated inbound upserts", async () => {
    const callSid = `CA-phase6-idem-${Date.now()}`;
    createdCallSids.push(callSid);
    const payload = {
      CallSid: callSid,
      From: "+972509998877",
      To: process.env.TWILIO_CLINIC_PHONE_NUMBER!,
      CallStatus: "ringing",
    };

    const first = await webhookService.handleInbound(payload);
    const second = await webhookService.handleInbound(payload);
    expect(first.ok && second.ok).toBe(true);

    const { count } = await adminClient
      .from("voice_calls")
      .select("*", { count: "exact", head: true })
      .eq("twilio_call_sid", callSid);
    expect(count).toBe(1);
  });
});
