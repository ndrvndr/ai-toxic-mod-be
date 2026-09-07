export type PlatformType = "youtube" | "twitch" | "tiktok";

export type ActionType = "none" | "warn" | "delete" | "timeout" | "ban";

/**
 * Normalized chat messages from any platform.
 * This is the only form of message that the ModerationCoreService is allowed to see.
 */
export interface NormalizedChatMessage {
  platformMessageId: string;
  platformUserId: string;
  authorDisplayName: string;
  text: string;
  sentAt: Date;
  rawPayload?: unknown;
}

/**
 * A generic moderation action request sent from ModerationCore/Worker to the Adapter.
 */
export interface ModerationActionRequest {
  connectionId: string;
  liveSessionId: string;
  platformMessageId: string;
  platformUserId: string;
  actionType: ActionType;
  reason: string;
  timeoutDurationSeconds?: number;
}

export interface ModerationActionResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  executedAt: Date;
}

/**
 * Credentials passed to the adapter. The adapter never accesses the database directly.
 */
export interface PlatformCredentials {
  connectionId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  platformUserId: string;
  platformChannelName?: string;
}

export type OnMessageCallback = (
  connectionId: string,
  message: NormalizedChatMessage,
) => Promise<void>;

export enum AdapterErrorCode {
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_REVOKED = "TOKEN_REVOKED",
  RATE_LIMITED = "RATE_LIMITED",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  TARGET_NOT_FOUND = "TARGET_NOT_FOUND",
  PLATFORM_UNAVAILABLE = "PLATFORM_UNAVAILABLE",
  UNKNOWN = "UNKNOWN",
}

export class AdapterError extends Error {
  constructor(
    public code: AdapterErrorCode,
    message: string,
    public retryable: boolean = false,
  ) {
    super(message);
  }
}
