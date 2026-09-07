import { Module } from "@nestjs/common";

import { PrismaService } from "../../prisma.service";
import { YouTubeAuthController } from "./youtube-auth.controller";
import { YouTubeAuthService } from "./youtube-auth.service";
import { YouTubeListenerService } from "./youtube-listener.service";

@Module({
  controllers: [YouTubeAuthController],
  providers: [YouTubeAuthService, YouTubeListenerService, PrismaService],
  exports: [YouTubeAuthService],
})
export class YouTubeModule {}
