import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAgent = vi.fn();
const mockUpdateAgent = vi.fn();

vi.mock("elevenlabs", () => ({
  ElevenLabsClient: vi.fn().mockImplementation(function () {
    return {
      conversationalAi: {
        getAgent: mockGetAgent,
        updateAgent: mockUpdateAgent,
      },
    };
  }),
}));

process.env.ELEVENLABS_API_KEY = "test-key";
process.env.ELEVENLABS_AGENT_ID = "test-agent";
process.env.ELEVENLABS_TEST_IDS = "test-1,test-2";

import { publishPrompt } from "@/lib/learning/elevenlabsTesting";

beforeEach(() => {
  mockGetAgent.mockReset();
  mockUpdateAgent.mockReset();
});

describe("publishPrompt", () => {
  it("preserves the live agent's tools, knowledge_base, and rag when publishing a new prompt", async () => {
    mockGetAgent.mockResolvedValue({
      agent_id: "test-agent",
      name: "Tomer",
      conversation_config: {
        agent: {
          prompt: {
            prompt: "old prompt",
            tools: [{ type: "webhook", name: "lookup-customer" }],
            knowledge_base: [{ type: "text", name: "tomer-kb-clinic_info", id: "doc-1", usage_mode: "prompt" }],
            rag: { enabled: false },
          },
        },
      },
      metadata: {},
    });
    mockUpdateAgent.mockResolvedValue({ agent_id: "test-agent" });

    await publishPrompt("new prompt text");

    expect(mockUpdateAgent).toHaveBeenCalledWith("test-agent", {
      conversation_config: {
        agent: {
          prompt: {
            prompt: "new prompt text",
            tools: [{ type: "webhook", name: "lookup-customer" }],
            knowledge_base: [{ type: "text", name: "tomer-kb-clinic_info", id: "doc-1", usage_mode: "prompt" }],
            rag: { enabled: false },
          },
        },
      },
    });
  });

  it("still publishes with undefined tools/knowledge_base/rag when the live agent has none set", async () => {
    mockGetAgent.mockResolvedValue({
      agent_id: "test-agent",
      name: "Tomer",
      conversation_config: { agent: { prompt: { prompt: "old prompt" } } },
      metadata: {},
    });
    mockUpdateAgent.mockResolvedValue({ agent_id: "test-agent" });

    await publishPrompt("new prompt text");

    expect(mockUpdateAgent).toHaveBeenCalledWith("test-agent", {
      conversation_config: {
        agent: {
          prompt: {
            prompt: "new prompt text",
            tools: undefined,
            knowledge_base: undefined,
            rag: undefined,
          },
        },
      },
    });
  });
});
