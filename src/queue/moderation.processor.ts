import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { ModerationCoreService } from "../moderation-core/moderation-core.service";
import type { NormalizedChatMessage } from "../platform-adapters/interfaces";
import { YouTubeActionExecutorService } from "../platform-adapters/youtube/youtube-action-executor.service";
import { PrismaService } from "../prisma.service";
import { ModerationGateway } from "../websocket/moderation.gateway";

export interface ModerationJobData {
  connectionId: string;
  streamerId: string;
  liveSessionId: string;
  liveChatId: string;
  message: NormalizedChatMessage;
}

const FAILURE_ALERT_THRESHOLD = 3;

@Processor("moderation-queue")
export class ModerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ModerationProcessor.name);

  private consecutiveFailures = new Map<string, number>();

  constructor(
    private moderationCore: ModerationCoreService,
    private prisma: PrismaService,
    private youtubeExecutor: YouTubeActionExecutorService,
    private gateway: ModerationGateway,
  ) {
    super();
  }

  async process(job: Job<ModerationJobData>): Promise<void> {
    const { liveSessionId, liveChatId, streamerId, connectionId, message } =
      job.data;

    let chatMessage;
    try {
      chatMessage = await this.prisma.db.orm.public.ChatMessage.create({
        liveSessionId,
        platformMessageId: message.platformMessageId,
        platformUserId: message.platformUserId,
        authorDisplayName: message.authorDisplayName,
        messageText: message.text,
        sentAt: new Date(message.sentAt).toISOString(),
      });
    } catch (error: any) {
      this.logger.warn(
        `Skipping duplicate message ${message.platformMessageId} for session ${liveSessionId}`,
      );
      return;
    }

    const decision = await this.moderationCore.processMessage(
      chatMessage.id,
      streamerId,
      message,
    );

    await this.prisma.db.orm.public.ChatMessage.where({
      id: chatMessage.id,
    }).update({
      messageTextNormalized: decision.normalizedText,
    });

    this.logger.log(
      `Message from ${message.authorDisplayName}: "${message.text}" -> ${decision.actionType} (${decision.reason})`,
    );

    this.gateway.notifyNewMessage(liveSessionId, {
      id: chatMessage.id,
      authorDisplayName: message.authorDisplayName,
      text: message.text,
      sentAt: message.sentAt,
      toxicityLabel: decision.actionType === "none" ? "safe" : "flagged",
      reason: decision.reason,
    });

    if (!decision.shouldTakeAction || decision.actionType === "none") {
      return;
    }

    const action = await this.prisma.db.orm.public.ModerationAction.create({
      chatMessageId: chatMessage.id,
      actionType: decision.actionType as any,
      reason: decision.reason,
      triggeredBy: "auto",
      status: "pending",
    });

    const connection = await this.prisma.db.orm.public.PlatformConnection.where(
      {
        id: connectionId,
      },
    ).first();

    if (!connection?.refreshToken) {
      await this.prisma.db.orm.public.ModerationAction.where({
        id: action.id,
      }).update({
        status: "failed",
        errorMessage: "No refresh token available",
      });
      this.handleActionFailure(
        streamerId,
        liveSessionId,
        "No refresh token available",
      );
      return;
    }

    const result = await this.youtubeExecutor.execute({
      refreshToken: connection.refreshToken,
      liveChatId,
      platformMessageId: message.platformMessageId,
      platformUserId: message.platformUserId,
      actionType: decision.actionType as any,
    });

    await this.prisma.db.orm.public.ModerationAction.where({
      id: action.id,
    }).update({
      status: result.success ? "success" : "failed",
      errorMessage: result.errorMessage,
    });

    this.gateway.notifyModerationAction(liveSessionId, {
      chatMessageId: chatMessage.id,
      actionType: decision.actionType,
      status: result.success ? "success" : "failed",
      reason: decision.reason,
    });

    if (result.success) {
      this.consecutiveFailures.delete(streamerId);
    } else {
      this.handleActionFailure(
        streamerId,
        liveSessionId,
        result.errorMessage ?? "Unknown error",
      );
    }
  }

  private handleActionFailure(
    streamerId: string,
    liveSessionId: string,
    errorMessage: string,
  ) {
    const count = (this.consecutiveFailures.get(streamerId) ?? 0) + 1;
    this.consecutiveFailures.set(streamerId, count);

    this.logger.warn(
      `Consecutive action failures for streamer ${streamerId}: ${count}`,
    );

    if (count >= FAILURE_ALERT_THRESHOLD) {
      this.gateway.notifySystemAlert(liveSessionId, {
        severity: "error",
        message: `Moderation actions have failed ${count} times in a row. Reason: ${errorMessage}. Your YouTube connection may need to be reconnected.`,
      });
    }
  }
}
