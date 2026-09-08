import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { YouTubeModule } from "../platform-adapters/youtube/youtube.module";
import { LiveSessionsController } from "./live-sessions.controller";
import { LiveSessionsService } from "./live-sessions.service";

@Module({
  imports: [
    AuthModule,
    YouTubeModule,
    BullModule.registerQueue({ name: "moderation-queue" }),
  ],
  controllers: [LiveSessionsController],
  providers: [LiveSessionsService],
})
export class LiveSessionsModule {}
