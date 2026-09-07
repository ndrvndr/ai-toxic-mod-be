import { Module } from "@nestjs/common";

import { ModerationCoreService } from "./moderation-core.service";
import { RuleEngineService } from "./rule-engine.service";
import { ToxicityClassifierService } from "./toxicity-classifier.service";

@Module({
  providers: [
    ToxicityClassifierService,
    RuleEngineService,
    ModerationCoreService,
  ],
  exports: [ModerationCoreService],
})
export class ModerationCoreModule {}
