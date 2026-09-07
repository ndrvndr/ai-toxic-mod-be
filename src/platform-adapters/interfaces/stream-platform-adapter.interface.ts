import type {
  ActionType,
  ModerationActionRequest,
  ModerationActionResult,
  OnMessageCallback,
  PlatformCredentials,
  PlatformType,
} from "./types";

export interface IStreamPlatformAdapter {
  readonly platform: PlatformType;

  // ── AUTH ──────────────────────────────────────────
  getAuthUrl(streamerId: string, redirectState?: string): string;
  handleOAuthCallback(
    code: string,
    streamerId: string,
  ): Promise<PlatformCredentials>;
  refreshAccessToken(
    credentials: PlatformCredentials,
  ): Promise<PlatformCredentials>;
  revokeAccess(credentials: PlatformCredentials): Promise<void>;

  // ── LISTENING ─────────────────────────────────────
  startListening(
    credentials: PlatformCredentials,
    liveSessionId: string,
    onMessage: OnMessageCallback,
  ): Promise<void>;
  stopListening(liveSessionId: string): Promise<void>;
  isListening(liveSessionId: string): boolean;

  // ── ACTIONS ───────────────────────────────────────
  executeAction(
    credentials: PlatformCredentials,
    request: ModerationActionRequest,
  ): Promise<ModerationActionResult>;

  // ── CAPABILITY DISCOVERY ──────────────────────────
  getSupportedActions(): ActionType[];
}
