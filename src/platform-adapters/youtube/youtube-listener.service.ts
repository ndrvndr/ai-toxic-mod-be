import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { google } from "googleapis";

import { PrismaService } from "../../prisma.service";
import type { NormalizedChatMessage, OnMessageCallback } from "../interfaces";

interface ActivePolling {
  timer: ReturnType<typeof setTimeout>;
  stopped: boolean;
}

@Injectable()
export class YouTubeListenerService {
  private readonly logger = new Logger(YouTubeListenerService.name);
  private activePollings = new Map<string, ActivePolling>();

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  private createOAuthClient(refreshToken: string) {
    const client = new google.auth.OAuth2(
      this.configService.get<string>("YOUTUBE_CLIENT_ID"),
      this.configService.get<string>("YOUTUBE_CLIENT_SECRET"),
      this.configService.get<string>("YOUTUBE_REDIRECT_URI"),
    );
    client.setCredentials({ refresh_token: refreshToken });
    return client;
  }

  async findActiveLiveChatId(refreshToken: string): Promise<string | null> {
    const client = this.createOAuthClient(refreshToken);
    const youtube = google.youtube({ version: "v3", auth: client });

    const response = await youtube.liveBroadcasts.list({
      part: ["snippet", "status"],
      broadcastStatus: "active",
      broadcastType: "all",
    });

    return response.data.items?.[0]?.snippet?.liveChatId ?? null;
  }

  async startListening(
    liveSessionId: string,
    refreshToken: string,
    liveChatId: string,
    onMessage: OnMessageCallback,
    connectionId: string,
  ): Promise<void> {
    if (this.activePollings.has(liveSessionId)) {
      this.logger.warn(`Already listening to session ${liveSessionId}`);
      return;
    }

    const client = this.createOAuthClient(refreshToken);
    const youtube = google.youtube({ version: "v3", auth: client });

    const session = await this.prisma.db.orm.public.LiveSession.where({
      id: liveSessionId,
    }).first();

    let pageToken: string | undefined = session?.nextPageToken ?? undefined;

    const polling: ActivePolling = { timer: null as any, stopped: false };
    this.activePollings.set(liveSessionId, polling);

    const poll = async () => {
      if (polling.stopped) return;

      try {
        const response = await youtube.liveChatMessages.list({
          liveChatId,
          part: ["snippet", "authorDetails"],
          pageToken,
        });

        if (response.data.offlineAt) {
          this.logger.log(
            `Live session ${liveSessionId} ended (offlineAt detected). Stopping listener.`,
          );
          await this.handleSessionEnded(liveSessionId);
          return;
        }

        for (const item of response.data.items ?? []) {
          if (!item.id || !item.snippet?.textMessageDetails?.messageText)
            continue;

          const normalized: NormalizedChatMessage = {
            platformMessageId: item.id,
            platformUserId: item.authorDetails?.channelId ?? "unknown",
            authorDisplayName: item.authorDetails?.displayName ?? "Unknown",
            text: item.snippet.textMessageDetails.messageText,
            sentAt: item.snippet.publishedAt
              ? new Date(item.snippet.publishedAt)
              : new Date(),
            rawPayload: item,
          };

          await onMessage(connectionId, normalized);
        }

        pageToken = response.data.nextPageToken ?? undefined;

        await this.prisma.db.orm.public.LiveSession.where({
          id: liveSessionId,
        }).update({
          nextPageToken: pageToken,
        });

        const interval = response.data.pollingIntervalMillis ?? 5000;

        if (!polling.stopped) {
          polling.timer = setTimeout(poll, interval);
        }
      } catch (error: any) {
        const reason =
          error?.errors?.[0]?.reason ??
          error?.response?.data?.error?.errors?.[0]?.reason;

        if (reason === "liveChatEnded" || reason === "liveChatNotFound") {
          this.logger.log(
            `Live session ${liveSessionId} ended (${reason}). Stopping listener.`,
          );
          await this.handleSessionEnded(liveSessionId);
          return;
        }

        this.logger.error(`Polling error for session ${liveSessionId}:`, error);
        if (!polling.stopped) {
          polling.timer = setTimeout(poll, 5000);
        }
      }
    };

    await poll();
  }

  private async handleSessionEnded(liveSessionId: string): Promise<void> {
    this.stopListening(liveSessionId);
    await this.prisma.db.orm.public.LiveSession.where({
      id: liveSessionId,
    }).update({
      status: "ended",
      endedAt: new Date().toISOString(),
    });
  }

  stopListening(liveSessionId: string): void {
    const polling = this.activePollings.get(liveSessionId);
    if (polling) {
      polling.stopped = true;
      clearTimeout(polling.timer);
      this.activePollings.delete(liveSessionId);
    }
  }

  isListening(liveSessionId: string): boolean {
    return this.activePollings.has(liveSessionId);
  }

  async findActiveBroadcast(refreshToken: string): Promise<{
    broadcastId: string;
    liveChatId: string;
    title: string;
  } | null> {
    const client = this.createOAuthClient(refreshToken);
    const youtube = google.youtube({ version: "v3", auth: client });

    const response = await youtube.liveBroadcasts.list({
      part: ["snippet", "status"],
      broadcastStatus: "active",
      broadcastType: "all",
    });

    const broadcast = response.data.items?.[0];
    if (!broadcast?.id || !broadcast.snippet?.liveChatId) {
      return null;
    }

    return {
      broadcastId: broadcast.id,
      liveChatId: broadcast.snippet.liveChatId,
      title: broadcast.snippet.title ?? "Untitled Stream",
    };
  }
}
