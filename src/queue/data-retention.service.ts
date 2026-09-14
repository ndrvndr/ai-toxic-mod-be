import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { db } from "../prisma/db";

const RETENTION_DAYS = 30;

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldMessages() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    const oldSessions = await db.orm.public.LiveSession.where({
      status: "ended",
    }).all();

    const sessionsToClean = oldSessions.filter(
      (s) => s.endedAt && new Date(s.endedAt) < cutoffDate,
    );

    let deletedCount = 0;

    for (const session of sessionsToClean) {
      const messages = await db.orm.public.ChatMessage.where({
        liveSessionId: session.id,
      }).all();

      for (const message of messages) {
        const actions = await db.orm.public.ModerationAction.where({
          chatMessageId: message.id,
        }).all();

        if (actions.length === 0) {
          await db.orm.public.ChatMessage.where({ id: message.id }).delete();
          deletedCount++;
        }
      }
    }

    this.logger.log(
      `Data retention cleanup: removed ${deletedCount} non-flagged messages older than ${RETENTION_DAYS} days`,
    );
  }
}
