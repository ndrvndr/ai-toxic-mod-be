import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ModerationGateway } from "./moderation.gateway";

@Module({
  imports: [AuthModule],
  providers: [ModerationGateway],
  exports: [ModerationGateway],
})
export class WebsocketModule {}
