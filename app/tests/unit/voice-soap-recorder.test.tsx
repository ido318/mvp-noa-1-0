import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VoiceSoapRecorder } from "@/app/dashboard/visits/voice-soap-recorder";

const { mockRefresh } = vi.hoisted(() => ({ mockRefresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// A minimal fake standing in for the browser's MediaRecorder, which
// doesn't exist in jsdom. `stop()` synchronously fires `ondataavailable`
// then `onstop`, exactly like the shape the component relies on.
class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = vi.fn().mockReturnValue(true);

  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => {
    this.ondataavailable?.({ data: new Blob(["fake-audio-bytes"], { type: "audio/webm" }) });
    this.onstop?.();
  });

  constructor(
    public stream: unknown,
    public options?: { mimeType?: string },
  ) {
    FakeMediaRecorder.instances.push(this);
  }
}

const fakeTrack = { stop: vi.fn() };
const fakeStream = { getTracks: () => [fakeTrack] };

function okJsonResponse(data: unknown = {}): Response {
  return { ok: true, json: async () => ({ data }) } as Response;
}

function errorJsonResponse(message: string): Response {
  return { ok: false, json: async () => ({ error: { message } }) } as Response;
}

async function recordAndStop() {
  fireEvent.click(screen.getByRole("button", { name: "הקלטה" }));
  await screen.findByRole("button", { name: "עצור הקלטה" });
  fireEvent.click(screen.getByRole("button", { name: "עצור הקלטה" }));
}

describe("VoiceSoapRecorder", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    FakeMediaRecorder.instances = [];
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(window.navigator, "mediaDevices", {
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("records, uploads, drafts, and renders an editable form pre-filled with the draft values", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okJsonResponse({ storagePath: "clinic-1/visit-1/rec.webm" }))
      .mockResolvedValueOnce(
        okJsonResponse({
          id: "artifact-1",
          structuredPayload: {
            subjective: "בעל הכלב מדווח על הקאות",
            objective: "טמפרטורה 39.2",
            assessment: "חשד לדלקת קיבה",
            plan: "צום 12 שעות ומעקב",
          },
        }),
      );

    render(<VoiceSoapRecorder visitId="visit-1" />);
    await recordAndStop();

    expect(await screen.findByLabelText("סובייקטיבי")).toHaveValue("בעל הכלב מדווח על הקאות");
    expect(screen.getByLabelText("אובייקטיבי")).toHaveValue("טמפרטורה 39.2");
    expect(screen.getByLabelText("הערכה")).toHaveValue("חשד לדלקת קיבה");
    expect(screen.getByLabelText("תוכנית טיפול")).toHaveValue("צום 12 שעות ומעקב");

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "/api/visits/visit-1/soap-recording",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/visits/visit-1/soap-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storagePath: "clinic-1/visit-1/rec.webm" }),
    });
  });

  it("submits the CURRENT edited values, not the original draft, and resets after success", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okJsonResponse({ storagePath: "clinic-1/visit-1/rec.webm" }))
      .mockResolvedValueOnce(
        okJsonResponse({
          id: "artifact-1",
          structuredPayload: {
            subjective: "טקסט מקורי",
            objective: "טקסט מקורי",
            assessment: "טקסט מקורי",
            plan: "טקסט מקורי",
          },
        }),
      )
      .mockResolvedValueOnce(okJsonResponse({ id: "note-1" })) // notes create
      .mockResolvedValueOnce(okJsonResponse({ id: "artifact-1" })); // artifact approve

    render(<VoiceSoapRecorder visitId="visit-1" />);
    await recordAndStop();
    await screen.findByLabelText("סובייקטיבי");

    fireEvent.change(screen.getByLabelText("סובייקטיבי"), { target: { value: "עדכון ידני של הרופא" } });

    fireEvent.click(screen.getByRole("button", { name: "הוסף כהערה" }));

    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenNthCalledWith(3, "/api/visits/visit-1/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteType: "general",
        content:
          "סובייקטיבי:\nעדכון ידני של הרופא\n\nאובייקטיבי:\nטקסט מקורי\n\nהערכה:\nטקסט מקורי\n\nתוכנית טיפול:\nטקסט מקורי",
        subjective: "עדכון ידני של הרופא",
        objective: "טקסט מקורי",
        assessment: "טקסט מקורי",
        plan: "טקסט מקורי",
      }),
    });

    // Also calls the artifact-approve endpoint for the originating draft.
    expect(fetch).toHaveBeenNthCalledWith(4, "/api/ai/artifacts/artifact-1/approve", { method: "POST" });

    // Resets back to the initial "הקלטה" button state, ready for another recording.
    expect(await screen.findByRole("button", { name: "הקלטה" })).toBeInTheDocument();
    expect(screen.queryByLabelText("סובייקטיבי")).not.toBeInTheDocument();
  });

  it("does not block on an artifact-approve failure — the note was already created successfully", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.mocked(fetch)
      .mockResolvedValueOnce(okJsonResponse({ storagePath: "clinic-1/visit-1/rec.webm" }))
      .mockResolvedValueOnce(
        okJsonResponse({
          id: "artifact-1",
          structuredPayload: { subjective: "s", objective: "o", assessment: "a", plan: "p" },
        }),
      )
      .mockResolvedValueOnce(okJsonResponse({ id: "note-1" })) // notes create succeeds
      .mockResolvedValueOnce(errorJsonResponse("שגיאת שרת")); // artifact approve fails

    render(<VoiceSoapRecorder visitId="visit-1" />);
    await recordAndStop();
    await screen.findByLabelText("סובייקטיבי");

    fireEvent.click(screen.getByRole("button", { name: "הוסף כהערה" }));

    await vi.waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(warnSpy).toHaveBeenCalled();
    // No scary error surfaced to the user — the primary action succeeded.
    expect(screen.queryByText("שגיאת שרת")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "הקלטה" })).toBeInTheDocument();

    warnSpy.mockRestore();
  });

  it("shows a clear error and returns to idle when the upload fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(errorJsonResponse("אין הרשאה להעלות הקלטה"));

    render(<VoiceSoapRecorder visitId="visit-1" />);
    await recordAndStop();

    expect(await screen.findByText("אין הרשאה להעלות הקלטה")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הקלטה" })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("shows a clear error and returns to idle when draft generation fails", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okJsonResponse({ storagePath: "clinic-1/visit-1/rec.webm" }))
      .mockResolvedValueOnce(errorJsonResponse("תמלול ההקלטה נכשל. נסה שוב מאוחר יותר."));

    render(<VoiceSoapRecorder visitId="visit-1" />);
    await recordAndStop();

    expect(await screen.findByText("תמלול ההקלטה נכשל. נסה שוב מאוחר יותר.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "הקלטה" })).toBeInTheDocument();
  });

  it("shows a pulsing recording indicator with an elapsed timer while recording", async () => {
    render(<VoiceSoapRecorder visitId="visit-1" />);
    fireEvent.click(screen.getByRole("button", { name: "הקלטה" }));

    expect(await screen.findByText(/מקליט/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "עצור הקלטה" })).toBeInTheDocument();
  });
});
