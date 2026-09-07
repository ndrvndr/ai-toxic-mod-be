import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { ModerationCoreModule } from "../moderation-core/moderation-core.module";
import { YouTubeModule } from "../platform-adapters/youtube/youtube.module";
import { ModerationProcessor } from "./moderation.processor";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "moderation-queue",
    }),
    ModerationCoreModule,
    YouTubeModule,
  ],
  providers: [ModerationProcessor],
  exports: [BullModule],
})
export class QueueModule {}
