import { Injectable } from "@nestjs/common";

import type { ActionType } from "../platform-adapters/interfaces";
import { PrismaService } from "../prisma.service";
import { normalizeText } from "./text-normalizer";
import type { ToxicityClassification } from "./toxicity-classifier.service";

export interface RuleEvaluationResult {
  shouldTakeAction: boolean;
  actionType: ActionType;
  reason: string;
  matchedBlacklistWords: string[];
}

@Injectable()
export class RuleEngineService {
  constructor(private prisma: PrismaService) {}

  async evaluate(
    streamerId: string,
    normalizedText: string,
    classification: ToxicityClassification,
  ): Promise<RuleEvaluationResult> {
    const rules = await this.prisma.db.orm.public.ModerationRule.where({
      streamerId,
      isActive: true,
    }).all();

    const whitelistRules = rules.filter((r) => r.ruleType === "whitelist_word");
    for (const rule of whitelistRules) {
      const rawWord = (rule.value as { word?: string })?.word;
      const word = rawWord ? normalizeText(rawWord) : undefined;
      if (word && normalizedText.includes(word)) {
        return {
          shouldTakeAction: false,
          actionType: "none",
          reason: `Whitelisted word matched: "${word}"`,
          matchedBlacklistWords: [],
        };
      }
    }

    const blacklistRules = rules.filter((r) => r.ruleType === "blacklist_word");
    const matchedWords: string[] = [];
    let blacklistAction: ActionType | null = null;

    for (const rule of blacklistRules) {
      const rawWord = (rule.value as { word?: string })?.word;
      const word = rawWord ? normalizeText(rawWord) : undefined;
      if (word && normalizedText.includes(word)) {
        matchedWords.push(word);
        blacklistAction = rule.actionOnTrigger;
      }
    }

    if (matchedWords.length > 0) {
      return {
        shouldTakeAction: true,
        actionType: blacklistAction ?? "delete",
        reason: `Blacklisted word(s) matched: ${matchedWords.join(", ")}`,
        matchedBlacklistWords: matchedWords,
      };
    }

    const thresholdRule = rules.find((r) => r.ruleType === "threshold");
    const customThreshold = (thresholdRule?.value as { threshold?: number })
      ?.threshold;
    const effectiveThreshold = customThreshold ?? 0.7;

    if (classification.score >= effectiveThreshold) {
      return {
        shouldTakeAction: true,
        actionType: thresholdRule?.actionOnTrigger ?? "delete",
        reason: `Toxicity score ${classification.score.toFixed(2)} exceeded threshold ${effectiveThreshold}`,
        matchedBlacklistWords: [],
      };
    }

    if (classification.label === "borderline") {
      return {
        shouldTakeAction: true,
        actionType: "warn",
        reason: `Toxicity score ${classification.score.toFixed(2)} is borderline`,
        matchedBlacklistWords: [],
      };
    }

    return {
      shouldTakeAction: false,
      actionType: "none",
      reason: "Message is safe",
      matchedBlacklistWords: [],
    };
  }
}
