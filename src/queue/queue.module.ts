import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { ModerationCoreModule } from "../moderation-core/moderation-core.module";
import { ModerationProcessor } from "./moderation.processor";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "moderation-queue",
    }),
    ModerationCoreModule,
  ],
  providers: [ModerationProcessor],
  exports: [BullModule],
})
export class QueueModule {}
