import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { LiveSessionsController } from "./live-sessions.controller";
import { LiveSessionsService } from "./live-sessions.service";

@Module({
  imports: [AuthModule],
  controllers: [LiveSessionsController],
  providers: [LiveSessionsService],
})
export class LiveSessionsModule {}
