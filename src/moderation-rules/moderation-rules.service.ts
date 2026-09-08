import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { ActionType } from "../platform-adapters/interfaces";
import { db } from "../prisma/db";

export interface CreateRuleInput {
  ruleType: "threshold" | "blacklist_word" | "whitelist_word";
  value: Record<string, unknown>;
  actionOnTrigger: ActionType;
}

export interface UpdateRuleInput {
  value?: Record<string, unknown>;
  actionOnTrigger?: ActionType;
  isActive?: boolean;
}

@Injectable()
export class ModerationRulesService {
  private normalizeValue(
    ruleType: string,
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    if (ruleType === "threshold") {
      const raw = value.threshold;
      const threshold = typeof raw === "string" ? parseFloat(raw) : raw;

      if (
        typeof threshold !== "number" ||
        Number.isNaN(threshold) ||
        threshold < 0 ||
        threshold > 1
      ) {
        throw new BadRequestException(
          "threshold must be a number between 0 and 1",
        );
      }

      return { threshold };
    }

    if (ruleType === "blacklist_word" || ruleType === "whitelist_word") {
      const word = value.word;
      if (typeof word !== "string" || word.trim().length === 0) {
        throw new BadRequestException("word must be a non-empty string");
      }
      return { word: word.trim().toLowerCase() };
    }

    return value;
  }

  async list(streamerId: string) {
    return db.orm.public.ModerationRule.where({ streamerId }).all();
  }

  async create(streamerId: string, input: CreateRuleInput) {
    const normalizedValue = this.normalizeValue(input.ruleType, input.value);

    return db.orm.public.ModerationRule.create({
      streamerId,
      ruleType: input.ruleType,
      value: normalizedValue as any, // JSON field; dynamic shape depending on ruleType
      actionOnTrigger: input.actionOnTrigger,
      isActive: true,
    });
  }

  async update(streamerId: string, ruleId: string, input: UpdateRuleInput) {
    const rule = await db.orm.public.ModerationRule.where({
      id: ruleId,
    }).first();

    if (!rule) {
      throw new NotFoundException("Rule not found");
    }
    if (rule.streamerId !== streamerId) {
      throw new ForbiddenException("You do not own this rule");
    }

    const updateData: Record<string, unknown> = { ...input };
    if (input.value) {
      updateData.value = this.normalizeValue(rule.ruleType, input.value);
    }

    return db.orm.public.ModerationRule.where({ id: ruleId }).update(
      updateData as any,
    );
  }

  async delete(streamerId: string, ruleId: string) {
    const rule = await db.orm.public.ModerationRule.where({
      id: ruleId,
    }).first();

    if (!rule) {
      throw new NotFoundException("Rule not found");
    }
    if (rule.streamerId !== streamerId) {
      throw new ForbiddenException("You do not own this rule");
    }

    await db.orm.public.ModerationRule.where({ id: ruleId }).delete();
    return { deleted: true };
  }
}
