import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { ModerationCoreModule } from "../moderation-core/moderation-core.module";
import { YouTubeModule } from "../platform-adapters/youtube/youtube.module";
import { WebsocketModule } from "../websocket/websocket.module";
import { ModerationQueueEventsService } from "./moderation-queue-events.service";
import { ModerationProcessor } from "./moderation.processor";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "moderation-queue",
    }),
    ModerationCoreModule,
    YouTubeModule,
    WebsocketModule,
  ],
  providers: [ModerationProcessor, ModerationQueueEventsService],
  exports: [BullModule],
})
export class QueueModule {}
