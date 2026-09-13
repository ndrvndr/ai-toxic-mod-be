import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { QueueEvents } from "bullmq";

@Injectable()
export class ModerationQueueEventsService implements OnModuleInit {
  private readonly logger = new Logger(ModerationQueueEventsService.name);

  onModuleInit() {
    const queueEvents = new QueueEvents("moderation-queue", {
      connection: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    });

    queueEvents.on("failed", ({ jobId, failedReason }) => {
      this.logger.error(
        `Job ${jobId} failed permanently after all retries: ${failedReason}`,
      );
      // TODO: If more serious alerts (email/Slack/etc.) are needed later, add them here.
    });
  }
}
