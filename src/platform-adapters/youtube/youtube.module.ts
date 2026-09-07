import { Module } from "@nestjs/common";

import { YouTubeActionExecutorService } from "./youtube-action-executor.service";
import { YouTubeAuthController } from "./youtube-auth.controller";
import { YouTubeAuthService } from "./youtube-auth.service";
import { YouTubeListenerService } from "./youtube-listener.service";

@Module({
  controllers: [YouTubeAuthController],
  providers: [
    YouTubeAuthService,
    YouTubeListenerService,
    YouTubeActionExecutorService,
  ],
  exports: [
    YouTubeAuthService,
    YouTubeListenerService,
    YouTubeActionExecutorService,
  ],
})
export class YouTubeModule {}
