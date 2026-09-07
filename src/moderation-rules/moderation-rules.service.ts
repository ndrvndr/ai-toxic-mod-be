import {
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
  async list(streamerId: string) {
    return db.orm.public.ModerationRule.where({ streamerId }).all();
  }

  async create(streamerId: string, input: CreateRuleInput) {
    return db.orm.public.ModerationRule.create({
      streamerId,
      ruleType: input.ruleType,
      value: input.value as any, // JSON field; dynamic shape depending on ruleType
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

    return db.orm.public.ModerationRule.where({ id: ruleId }).update(
      input as any,
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
