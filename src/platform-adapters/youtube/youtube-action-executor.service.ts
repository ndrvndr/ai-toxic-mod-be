import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";

import type { ActionType } from "../interfaces";

export interface ExecuteActionParams {
  refreshToken: string;
  liveChatId: string;
  platformMessageId: string;
  platformUserId: string;
  actionType: ActionType;
  timeoutDurationSeconds?: number;
}

export interface ActionExecutionResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

@Injectable()
export class YouTubeActionExecutorService {
  private readonly logger = new Logger(YouTubeActionExecutorService.name);

  constructor(private configService: ConfigService) {}

  private createClient(refreshToken: string) {
    const client = new google.auth.OAuth2(
      this.configService.get<string>("YOUTUBE_CLIENT_ID"),
      this.configService.get<string>("YOUTUBE_CLIENT_SECRET"),
      this.configService.get<string>("YOUTUBE_REDIRECT_URI"),
    );
    client.setCredentials({ refresh_token: refreshToken });
    return client;
  }

  async execute(params: ExecuteActionParams): Promise<ActionExecutionResult> {
    const client = this.createClient(params.refreshToken);
    const youtube = google.youtube({ version: "v3", auth: client });

    try {
      switch (params.actionType) {
        case "delete":
          await youtube.liveChatMessages.delete({
            id: params.platformMessageId,
          });
          this.logger.log(`Deleted message ${params.platformMessageId}`);
          break;

        case "ban":
          await youtube.liveChatBans.insert({
            part: ["snippet"],
            requestBody: {
              snippet: {
                type: "permanent",
                liveChatId: params.liveChatId,
                bannedUserDetails: { channelId: params.platformUserId },
              },
            },
          });
          this.logger.log(`Banned user ${params.platformUserId}`);
          break;

        case "timeout":
          await youtube.liveChatBans.insert({
            part: ["snippet"],
            requestBody: {
              snippet: {
                type: "temporary",
                liveChatId: params.liveChatId,
                bannedUserDetails: { channelId: params.platformUserId },
                banDurationSeconds: (
                  params.timeoutDurationSeconds ?? 300
                ).toString(),
              },
            },
          });
          this.logger.log(`Timed out user ${params.platformUserId}`);
          break;

        case "warn":
          // YouTube tidak punya native "warn" API, cukup dicatat
          this.logger.log(
            `[WARN] User ${params.platformUserId} (no native API for this)`,
          );
          break;

        case "none":
          break;
      }

      return { success: true };
    } catch (error: any) {
      this.logger.error(
        `Failed to execute ${params.actionType}: ${error.message}`,
      );
      return {
        success: false,
        errorCode: error.code?.toString() ?? "UNKNOWN",
        errorMessage: error.message,
      };
    }
  }
}
