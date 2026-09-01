export type SoapNoteDraft = {
  S: string | null;
  O: string | null;
  A: string | null;
  P: string | null;
};

export type SoapNoteGenerationResult = {
  draft: SoapNoteDraft;
  modelName: string;
  transcriptText: string;
};

export type SoapNoteProvider = {
  transcribeAndParse(
    audio: ArrayBuffer | Uint8Array,
    mimeType: string,
  ): Promise<SoapNoteGenerationResult>;
};
