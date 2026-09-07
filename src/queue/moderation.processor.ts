import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { ModerationCoreService } from "../moderation-core/moderation-core.service";
import type { NormalizedChatMessage } from "../platform-adapters/interfaces";
import { PrismaService } from "../prisma.service";

export interface ModerationJobData {
  connectionId: string;
  streamerId: string;
  liveSessionId: string;
  message: NormalizedChatMessage;
}

@Processor("moderation-queue")
export class ModerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ModerationProcessor.name);

  constructor(
    private moderationCore: ModerationCoreService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<ModerationJobData>): Promise<void> {
    const { liveSessionId, streamerId, message } = job.data;

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
    if (decision.shouldTakeAction) {
      await this.prisma.db.orm.public.ModerationAction.create({
        chatMessageId: chatMessage.id,
        actionType: decision.actionType as any,
        reason: decision.reason,
        triggeredBy: "auto",
        status: "pending", // still pending because there's no executor yet
      });
    }
  }
}
