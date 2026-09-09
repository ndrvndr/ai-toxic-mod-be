import { Injectable } from "@nestjs/common";

import type { NormalizedChatMessage } from "../platform-adapters/interfaces";
import { PrismaService } from "../prisma.service";
import { RuleEngineService } from "./rule-engine.service";
import { ToxicityClassifierService } from "./toxicity-classifier.service";

export interface ModerationDecision {
  shouldTakeAction: boolean;
  actionType: string;
  reason: string;
  normalizedText: string;
}

const LEETSPEAK_MAP: Record<string, string> = {
  "1": "i",
  "3": "e",
  "4": "a",
  "0": "o",
  "7": "t",
  "5": "s",
  "@": "a",
  $: "s",
};

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
      categoryScores: classification.breakdown as any,
      modelVersion: classification.modelVersion,
      processingDurationMs: durationMs,
    });

    return {
      shouldTakeAction: ruleResult.shouldTakeAction,
      actionType: ruleResult.actionType,
      reason: ruleResult.reason,
      normalizedText,
    };
  }

  private normalizeText(text: string): string {
    const lowercased = text.toLowerCase();

    const leetReplaced = lowercased.replace(
      /[134705$@]/g,
      (match) => LEETSPEAK_MAP[match] ?? match,
    );

    return leetReplaced
      .replace(/[^a-z\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
}
