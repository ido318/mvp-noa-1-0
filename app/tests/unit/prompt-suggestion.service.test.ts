import { describe, expect, it, vi, beforeEach } from "vitest";
import { ok } from "@/lib/errors/app-error";
import { PromptSuggestionService } from "@/lib/services/prompt-suggestion.service";
import type { PromptSuggestionRepository } from "@/lib/repositories/prompt-suggestion.repository";
import type { ServiceActor } from "@/lib/services/service-context";
import type { PromptSuggestion } from "@/types/domain/prompt-suggestion";

const { mockRunRegressionTests, mockGetLiveAgentConfig, mockPublishPrompt } = vi.hoisted(() => ({
  mockRunRegressionTests: vi.fn(),
  mockGetLiveAgentConfig: vi.fn(),
  mockPublishPrompt: vi.fn(),
}));

vi.mock("@/lib/learning/elevenlabsTesting", () => ({
  runRegressionTests: mockRunRegressionTests,
  getLiveAgentConfig: mockGetLiveAgentConfig,
  publishPrompt: mockPublishPrompt,
}));

const TARGET_CLINIC = "clinic-target";

const staffActor: ServiceActor = {
  userId: "user-1",
  clinicIds: [TARGET_CLINIC],
  defaultClinicId: TARGET_CLINIC,
  memberships: [{ clinicId: TARGET_CLINIC, role: "staff" }],
};

const adminActor: ServiceActor = {
  userId: "user-2",
  clinicIds: [TARGET_CLINIC],
  defaultClinicId: TARGET_CLINIC,
  memberships: [{ clinicId: TARGET_CLINIC, role: "admin" }],
};

function suggestion(overrides: Partial<PromptSuggestion> = {}): PromptSuggestion {
  return {
    id: "sugg-1",
    clinicId: TARGET_CLINIC,
    status: "pending",
    patternSummary: "תומר משתמש בביטוי אסור",
    suggestedPrompt: "פרומפט מתוקן",
    supportingCallReviewIds: ["r1", "r2"],
    regressionResult: null,
    previousPrompt: null,
    publishResult: null,
    reviewedByUserId: null,
    reviewedAt: null,
    publishedAt: null,
    createdAt: "2026-08-20T09:00:00.000Z",
    ...overrides,
  };
}

function buildService(overrides: Partial<ReturnType<typeof baseRepo>> = {}) {
  const repo = { ...baseRepo(), ...overrides };
  const service = new PromptSuggestionService(repo as unknown as PromptSuggestionRepository);
  return { service, repo };
}

function baseRepo() {
  return {
    listByStatus: vi.fn().mockResolvedValue(ok([suggestion()])),
    findById: vi.fn().mockResolvedValue(ok(suggestion())),
    markRejected: vi.fn().mockResolvedValue(ok(suggestion({ status: "rejected" }))),
    recordRegressionResult: vi.fn().mockImplementation((_id, input) =>
      Promise.resolve(ok(suggestion({ status: input.status, regressionResult: input.regressionResult }))),
    ),
    markPublished: vi.fn().mockImplementation((_id, input) =>
      Promise.resolve(
        ok(
          suggestion({
            status: "published",
            regressionResult: input.regressionResult,
            previousPrompt: input.previousPrompt,
            publishResult: input.publishResult,
          }),
        ),
      ),
    ),
  };
}

beforeEach(() => {
  mockRunRegressionTests.mockReset();
  mockGetLiveAgentConfig.mockReset();
  mockPublishPrompt.mockReset();
});

describe("PromptSuggestionService.reject", () => {
  it("forbids rejecting without owner/admin role in the suggestion's clinic", async () => {
    const { service, repo } = buildService();
    const result = await service.reject(staffActor, "sugg-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(403);
    expect(repo.markRejected).not.toHaveBeenCalled();
  });

  it("allows rejecting with owner/admin role", async () => {
    const { service, repo } = buildService();
    const result = await service.reject(adminActor, "sugg-1");
    expect(result.ok).toBe(true);
    expect(repo.markRejected).toHaveBeenCalledWith("sugg-1", adminActor.userId);
  });
});

describe("PromptSuggestionService.approve", () => {
  it("forbids approving without owner/admin role", async () => {
    const { service } = buildService();
    const result = await service.approve(staffActor, "sugg-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(403);
    expect(mockRunRegressionTests).not.toHaveBeenCalled();
  });

  it("refuses to re-approve a suggestion that was already reviewed", async () => {
    const { service } = buildService({
      findById: vi.fn().mockResolvedValue(ok(suggestion({ status: "published" }))),
    });
    const result = await service.approve(adminActor, "sugg-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(409);
    expect(mockRunRegressionTests).not.toHaveBeenCalled();
  });

  it("publishes when every regression test passes", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: true, raw: { test_results: [] } });
    mockGetLiveAgentConfig.mockResolvedValue({ agent: { prompt: { prompt: "old prompt" } } });
    mockPublishPrompt.mockResolvedValue({ agent_id: "agent_1" });

    const { service, repo } = buildService();
    const result = await service.approve(adminActor, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("published");
    expect(mockGetLiveAgentConfig).toHaveBeenCalled();
    expect(mockPublishPrompt).toHaveBeenCalledWith(suggestion().suggestedPrompt);
    expect(repo.markPublished).toHaveBeenCalledOnce();
    expect(repo.recordRegressionResult).not.toHaveBeenCalled();
  });

  it("does not publish and marks failed_regression when a test fails", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: false, raw: { test_results: [{ result: "failure" }] } });

    const { service, repo } = buildService();
    const result = await service.approve(adminActor, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("failed_regression");
    expect(mockPublishPrompt).not.toHaveBeenCalled();
    expect(repo.recordRegressionResult).toHaveBeenCalledWith(
      "sugg-1",
      expect.objectContaining({ status: "failed_regression" }),
    );
  });

  it("does not publish when the run-tests response can't be confidently parsed", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: null, raw: { unexpected: "shape" } });

    const { service, repo } = buildService();
    const result = await service.approve(adminActor, "sugg-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("pending");
    expect(mockPublishPrompt).not.toHaveBeenCalled();
    expect(repo.recordRegressionResult).toHaveBeenCalledWith(
      "sugg-1",
      expect.objectContaining({ status: "pending" }),
    );
  });

  it("does not publish when publish itself throws, even after regression passed", async () => {
    mockRunRegressionTests.mockResolvedValue({ allPassed: true, raw: {} });
    mockGetLiveAgentConfig.mockResolvedValue({});
    mockPublishPrompt.mockRejectedValue(new Error("ElevenLabs 500"));

    const { service, repo } = buildService();
    const result = await service.approve(adminActor, "sugg-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.status).toBe(502);
    expect(repo.markPublished).not.toHaveBeenCalled();
  });
});
