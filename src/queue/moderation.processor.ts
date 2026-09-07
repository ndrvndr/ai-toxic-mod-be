import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { ModerationCoreService } from "../moderation-core/moderation-core.service";
import type { NormalizedChatMessage } from "../platform-adapters/interfaces";
import { YouTubeActionExecutorService } from "../platform-adapters/youtube/youtube-action-executor.service";
import { PrismaService } from "../prisma.service";

export interface ModerationJobData {
  connectionId: string;
  streamerId: string;
  liveSessionId: string;
  liveChatId: string;
  message: NormalizedChatMessage;
}

@Processor("moderation-queue")
export class ModerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ModerationProcessor.name);

  constructor(
    private moderationCore: ModerationCoreService,
    private prisma: PrismaService,
    private youtubeExecutor: YouTubeActionExecutorService,
  ) {
    super();
  }

  async process(job: Job<ModerationJobData>): Promise<void> {
    const { liveSessionId, liveChatId, streamerId, connectionId, message } =
      job.data;

    // 1. Save the chat message to the database first.
    const chatMessage = await this.prisma.db.orm.public.ChatMessage.create({
      liveSessionId,
      platformMessageId: message.platformMessageId,
      platformUserId: message.platformUserId,
      authorDisplayName: message.authorDisplayName,
      messageText: message.text,
      sentAt: new Date(message.sentAt).toISOString(),
    });

    // 2. Process via moderation core (classify + rule engine)
    const decision = await this.moderationCore.processMessage(
      chatMessage.id,
      streamerId,
      message,
    );

    this.logger.log(
      `Message from ${message.authorDisplayName}: "${message.text}" -> ${decision.actionType} (${decision.reason})`,
    );

    // 3. If action needs to be taken, save it to moderation_actions.
    if (!decision.shouldTakeAction || decision.actionType === "none") {
      return;
    }

    // Save the action record with a 'pending' status first
    const action = await this.prisma.db.orm.public.ModerationAction.create({
      chatMessageId: chatMessage.id,
      actionType: decision.actionType as any,
      reason: decision.reason,
      triggeredBy: "auto",
      status: "pending",
    });

    // Get the refreshToken for execution
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
  }
}
