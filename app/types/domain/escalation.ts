export interface Escalation {
  id: string;
  clinicId: string;
  voiceCallId: string | null;
  elevenLabsConversationId: string | null;
  reason: string;
  urgency: number;
  resolvedAt: string | null;
  resolvedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Derived from notes JSON (written by triage engine in sprint 3)
  afterHours?: boolean;
}

export interface EscalationListFilters {
  clinicIds: string[];
  status?: "open" | "resolved";
  limit?: number;
  offset?: number;
}

export interface ResolveEscalationInput {
  notes?: string;
  resolvedByUserId: string;
}
