import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAgent = vi.fn();
const mockUpdateAgent = vi.fn();

vi.mock("@elevenlabs/elevenlabs-js", () => ({
  ElevenLabsClient: vi.fn().mockImplementation(function () {
    return {
      conversationalAi: {
        agents: {
          get: mockGetAgent,
          update: mockUpdateAgent,
        },
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
  it("preserves the live agent's tools, knowledgeBase, and rag when publishing a new prompt", async () => {
    mockGetAgent.mockResolvedValue({
      agentId: "test-agent",
      name: "Tomer",
      conversationConfig: {
        agent: {
          prompt: {
            prompt: "old prompt",
            tools: [{ type: "webhook", name: "lookup-customer" }],
            knowledgeBase: [{ type: "text", name: "tomer-kb-clinic_info", id: "doc-1", usageMode: "prompt" }],
            rag: { enabled: false },
          },
        },
      },
      metadata: {},
    });
    mockUpdateAgent.mockResolvedValue({ agentId: "test-agent" });

    await publishPrompt("new prompt text");

    expect(mockUpdateAgent).toHaveBeenCalledWith("test-agent", {
      conversationConfig: {
        agent: {
          prompt: {
            prompt: "new prompt text",
            tools: [{ type: "webhook", name: "lookup-customer" }],
            knowledgeBase: [{ type: "text", name: "tomer-kb-clinic_info", id: "doc-1", usageMode: "prompt" }],
            rag: { enabled: false },
          },
        },
      },
    });
    expect(mockGetAgent).toHaveBeenCalledWith("test-agent");
  });

  it("still publishes with undefined tools/knowledgeBase/rag when the live agent has none set", async () => {
    mockGetAgent.mockResolvedValue({
      agentId: "test-agent",
      name: "Tomer",
      conversationConfig: { agent: { prompt: { prompt: "old prompt" } } },
      metadata: {},
    });
    mockUpdateAgent.mockResolvedValue({ agentId: "test-agent" });

    await publishPrompt("new prompt text");

    expect(mockUpdateAgent).toHaveBeenCalledWith("test-agent", {
      conversationConfig: {
        agent: {
          prompt: {
            prompt: "new prompt text",
            tools: undefined,
            knowledgeBase: undefined,
            rag: undefined,
          },
        },
      },
    });
    expect(mockGetAgent).toHaveBeenCalledWith("test-agent");
  });
});
