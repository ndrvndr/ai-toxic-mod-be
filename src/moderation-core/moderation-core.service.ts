import { Injectable } from "@nestjs/common";

import type { NormalizedChatMessage } from "../platform-adapters/interfaces";
import { PrismaService } from "../prisma.service";
import { RuleEngineService } from "./rule-engine.service";
import { normalizeText } from "./text-normalizer";
import { ToxicityClassifierService } from "./toxicity-classifier.service";

export interface ModerationDecision {
  shouldTakeAction: boolean;
  actionType: string;
  reason: string;
  normalizedText: string;
}

@Injectable()
export class ModerationCoreService {
  constructor(
    private prisma: PrismaService,
    private classifier: ToxicityClassifierService,
    private ruleEngine: RuleEngineService,
  ) {}

  async processMessage(
    chatMessageId: string,
    streamerId: string,
    message: NormalizedChatMessage,
  ): Promise<ModerationDecision> {
    const start = Date.now();
    const normalizedMessageText = normalizeText(message.text);

    const classification = await this.classifier.classify(
      normalizedMessageText,
    );
    const ruleResult = await this.ruleEngine.evaluate(
      streamerId,
      normalizedMessageText,
      classification,
    );

    const durationMs = Date.now() - start;

    await this.prisma.db.orm.public.ModerationResult.create({
      chatMessageId,
      toxicityScore: classification.score,
      toxicityLabel: classification.label,
      matchedBlacklistWords: ruleResult.matchedBlacklistWords,
      categoryScores: classification.breakdown as any,
      modelVersion: classification.modelVersion,
      processingDurationMs: durationMs,
    });

    return {
      shouldTakeAction: ruleResult.shouldTakeAction,
      actionType: ruleResult.actionType,
      reason: ruleResult.reason,
      normalizedText: normalizedMessageText,
    };
  }
}
