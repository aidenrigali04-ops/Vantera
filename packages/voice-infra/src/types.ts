/** A drafted call brief the voice agent reads from when it dials. */
export interface CallBriefPayload {
  openingLine: string;
  talkingPoints: string[];
  /** meeting-as-offer: dream outcome + one honest reason it works (Hormozi value equation) */
  valueAngle?: string;
  /** a neutral consequence QUESTION inviting the prospect to voice the cost of inaction (NEPQ) */
  consequenceHook?: string;
  /** the de-risked, low-effort, fast next step framed as the offer */
  ahaMoment?: string;
  objectionHandling: string[];
  goalStatement: string;
  bookingLink: string;
}

export interface PlaceCallRequest {
  fromNumber: string;
  toNumber: string;
  voiceId: string;
  language: string;
  personaName: string;
  brief: CallBriefPayload;
  /** when true the opening must announce the call is recorded (two-party consent) */
  announceRecording: boolean;
  /** rides through the provider as metadata so webhooks attribute back to the call row */
  callRef: string;
}

export interface CallHandle {
  providerCallId: string;
  startedAt: string;
}

export type VoiceEvent =
  | { type: "call_started"; providerCallId: string; callRef: string | null }
  | {
      type: "call_ended";
      providerCallId: string;
      callRef: string | null;
      rawDisposition: string;
      durationSec: number;
      recordingUrl: string | null;
      transcript: string | null;
    };

/**
 * Provider-agnostic outbound-voice interface (rule 03–05). Retell is an
 * implementation detail behind it. Calling windows, attempt caps, and pacing
 * live in the pipeline/scheduler, NOT here.
 */
export interface VoiceInfra {
  placeCall(req: PlaceCallRequest): Promise<CallHandle>;
  /**
   * Reject forged payloads BEFORE parsing. Real adapters must use a timing-safe
   * comparison (crypto.timingSafeEqual); the in-memory fake uses plain equality.
   */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseEventWebhook(payload: unknown): VoiceEvent | null;
}
