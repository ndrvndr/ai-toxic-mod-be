import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { db } from "../prisma/db";

@Injectable()
export class LiveSessionsService {
  /**
   * List all of the streamer's live sessions (across all their connected platforms).
   */
  async list(streamerId: string) {
    const connections = await db.orm.public.PlatformConnection.where({
      streamerId,
    }).all();
    const connectionIds = connections.map((c) => c.id);

    if (connectionIds.length === 0) return [];

    // Per-connection query, as the syntax for the "in" operator in Prisma 8 has not yet been confirmed.
    const sessionsPerConnection = await Promise.all(
      connectionIds.map((id) =>
        db.orm.public.LiveSession.where({ connectionId: id }).all(),
      ),
    );

    return sessionsPerConnection.flat();
  }

  private async assertOwnership(streamerId: string, liveSessionId: string) {
    const session = await db.orm.public.LiveSession.where({
      id: liveSessionId,
    }).first();
    if (!session) throw new NotFoundException("Live session not found");

    const connection = await db.orm.public.PlatformConnection.where({
      id: session.connectionId,
    }).first();
    if (!connection || connection.streamerId !== streamerId) {
      throw new ForbiddenException("You do not own this live session");
    }

    return session;
  }

  /**
   * List chat messages for a single live session, with moderation results & actions.
   */
  async getMessages(streamerId: string, liveSessionId: string) {
    await this.assertOwnership(streamerId, liveSessionId);

    const messages = await db.orm.public.ChatMessage.where({
      liveSessionId,
    }).all();

    // N+1 queries per message to fetch results & actions -- enough for portfolio scale,
    // It can be optimized using batch or join queries once the data volume becomes large.
    const enriched = await Promise.all(
      messages.map(async (message) => {
        const result = await db.orm.public.ModerationResult.where({
          chatMessageId: message.id,
        }).first();
        const actions = await db.orm.public.ModerationAction.where({
          chatMessageId: message.id,
        }).all();

        return {
          ...message,
          moderationResult: result ?? null,
          moderationActions: actions,
        };
      }),
    );

    return enriched;
  }

  /**
   * Simple analytics summary for a single live session.
   */
  async getAnalytics(streamerId: string, liveSessionId: string) {
    await this.assertOwnership(streamerId, liveSessionId);

    const messages = await db.orm.public.ChatMessage.where({
      liveSessionId,
    }).all();
    const messageIds = messages.map((m) => m.id);

    let flaggedCount = 0;
    const actionCounts: Record<string, number> = {};

    for (const id of messageIds) {
      const actions = await db.orm.public.ModerationAction.where({
        chatMessageId: id,
      }).all();
      if (actions.length > 0) {
        flaggedCount++;
        for (const action of actions) {
          actionCounts[action.actionType] =
            (actionCounts[action.actionType] ?? 0) + 1;
        }
      }
    }

    return {
      totalMessages: messages.length,
      flaggedMessages: flaggedCount,
      flaggedPercentage:
        messages.length > 0 ? (flaggedCount / messages.length) * 100 : 0,
      actionBreakdown: actionCounts,
    };
  }
}
