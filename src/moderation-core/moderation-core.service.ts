import { Injectable } from "@nestjs/common";

import type { NormalizedChatMessage } from "../platform-adapters/interfaces";
import type { PrismaService } from "../prisma.service";
import { RuleEngineService } from "./rule-engine.service";
import { ToxicityClassifierService } from "./toxicity-classifier.service";

export interface ModerationDecision {
  shouldTakeAction: boolean;
  actionType: string;
  reason: string;
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
    const normalizedText = this.normalizeText(message.text);

    const classification = await this.classifier.classify(normalizedText);
    const ruleResult = await this.ruleEngine.evaluate(
      streamerId,
      normalizedText,
      classification,
    );

    const durationMs = Date.now() - start;

    await this.prisma.db.orm.public.ModerationResult.create({
      chatMessageId,
      toxicityScore: classification.score,
      toxicityLabel: classification.label,
      matchedBlacklistWords: ruleResult.matchedBlacklistWords,
      modelVersion: classification.modelVersion,
      processingDurationMs: durationMs,
    });

    return {
      shouldTakeAction: ruleResult.shouldTakeAction,
      actionType: ruleResult.actionType,
      reason: ruleResult.reason,
    };
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
}
