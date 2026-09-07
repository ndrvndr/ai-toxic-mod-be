import { Module } from "@nestjs/common";

import { YouTubeAuthController } from "./youtube-auth.controller";
import { YouTubeAuthService } from "./youtube-auth.service";
import { YouTubeListenerService } from "./youtube-listener.service";

@Module({
  controllers: [YouTubeAuthController],
  providers: [YouTubeAuthService, YouTubeListenerService],
  exports: [YouTubeAuthService, YouTubeListenerService],
})
export class YouTubeModule {}
