import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ModerationRulesController } from "./moderation-rules.controller";
import { ModerationRulesService } from "./moderation-rules.service";

@Module({
  imports: [AuthModule],
  controllers: [ModerationRulesController],
  providers: [ModerationRulesService],
})
export class ModerationRulesModule {}
