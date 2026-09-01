import { createOpenAI } from "@ai-sdk/openai";
import { experimental_transcribe as transcribe, generateObject } from "ai";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/ai/soap-note/prompt";
import type {
  SoapNoteDraft,
  SoapNoteGenerationResult,
  SoapNoteProvider,
} from "@/lib/ai/soap-note/types";

const soapNoteDraftSchema = z.object({
  S: z.string().nullable(),
  O: z.string().nullable(),
  A: z.string().nullable(),
  P: z.string().nullable(),
});

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getSoapTranscribeModelName(): string {
  return process.env.SOAP_TRANSCRIBE_MODEL ?? "whisper-1";
}

export function getSoapParseModelName(): string {
  return process.env.SOAP_PARSE_MODEL ?? "gpt-4o-mini";
}

export function createOpenAiSoapNoteProvider(): SoapNoteProvider {
  return {
    async transcribeAndParse(
      audio: ArrayBuffer | Uint8Array,
      mimeType: string,
    ): Promise<SoapNoteGenerationResult> {
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const openai = createOpenAI({ apiKey });

      // Note: the installed `ai` SDK's `experimental_transcribe` has no
      // parameter to force the audio media type — it auto-detects it from
      // the byte signature (falling back to audio/wav) and does not accept
      // an override. `mimeType` is accepted here for interface parity with
      // callers (who know the recorded file's real content type) but is not
      // forwarded to the SDK call.
      void mimeType;

      const transcriptionResult = await transcribe({
        model: openai.transcription(getSoapTranscribeModelName()),
        audio,
      });

      const transcriptText = transcriptionResult.text.trim();
      if (!transcriptText) {
        throw new Error("Transcription returned empty text");
      }

      const parseModelName = getSoapParseModelName();

      const { object } = await generateObject({
        model: openai(parseModelName),
        system: getSystemPrompt(),
        prompt: transcriptText,
        schema: soapNoteDraftSchema,
      });

      return {
        draft: object,
        modelName: parseModelName,
        transcriptText,
      };
    },
  };
}

export function createStubSoapNoteProvider(
  overrides?: Partial<SoapNoteDraft>,
): SoapNoteProvider {
  const draft: SoapNoteDraft = {
    S: "בעלים מדווח על תיאבון ירוד ועייפות קלה בבית.",
    O: "טמפרטורה 38.9 מעלות, דופק 110, נשימה תקינה. מצב גוף תקין.",
    A: "חשד לזיהום קל בדרכי העיכול.",
    P: "מנוחה ומעקב, חזרה לביקורת בעוד שבוע אם אין שיפור.",
    ...overrides,
  };

  return {
    async transcribeAndParse(): Promise<SoapNoteGenerationResult> {
      return {
        draft,
        modelName: "stub",
        transcriptText: "תמלול לדוגמה לצורכי בדיקות.",
      };
    },
  };
}

export async function transcribeAndParseSoapNote(
  audio: ArrayBuffer | Uint8Array,
  mimeType: string,
  provider?: SoapNoteProvider,
): Promise<SoapNoteGenerationResult> {
  const resolved =
    provider ??
    (process.env.VITEST === "true" || process.env.NODE_ENV === "test"
      ? createStubSoapNoteProvider()
      : createOpenAiSoapNoteProvider());

  return resolved.transcribeAndParse(audio, mimeType);
}
