import { getQueueToken } from "@nestjs/bullmq";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Queue } from "bullmq";

import type { NormalizedChatMessage } from "../platform-adapters/interfaces";
import { YouTubeListenerService } from "../platform-adapters/youtube/youtube-listener.service";
import { db } from "../prisma/db";
import type { ModerationJobData } from "../queue/moderation.processor";

@Injectable()
export class LiveSessionsService {
  constructor(
    private youtubeListener: YouTubeListenerService,
    @Inject(getQueueToken("moderation-queue"))
    private moderationQueue: Queue<ModerationJobData>,
  ) {}

  async list(streamerId: string) {
    const connections = await db.orm.public.PlatformConnection.where({
      streamerId,
    }).all();
    const connectionIds = connections.map((c) => c.id);

    if (connectionIds.length === 0) return [];

    const sessionsPerConnection = await Promise.all(
      connectionIds.map((id) =>
        db.orm.public.LiveSession.where({ connectionId: id }).all(),
      ),
    );

    return sessionsPerConnection
      .flat()
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
  }

  async listPaginated(
    streamerId: string,
    options: { page: number; limit: number; search?: string },
  ) {
    const { page, limit, search } = options;

    const connections = await db.orm.public.PlatformConnection.where({
      streamerId,
    }).all();
    const connectionIds = connections.map((c) => c.id);

    if (connectionIds.length === 0) {
      return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
    }

    const sessionsPerConnection = await Promise.all(
      connectionIds.map((id) =>
        db.orm.public.LiveSession.where({ connectionId: id }).all(),
      ),
    );

    let allSessions = sessionsPerConnection
      .flat()
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );

    if (search?.trim()) {
      const query = search.trim().toLowerCase();
      allSessions = allSessions.filter((s) =>
        (s.title ?? s.platformLiveId).toLowerCase().includes(query),
      );
    }

    const total = allSessions.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paginatedData = allSessions.slice(start, start + limit);

    return {
      data: paginatedData,
      meta: { page, limit, total, totalPages },
    };
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

    return { session, connection };
  }

  async getMessages(streamerId: string, liveSessionId: string) {
    await this.assertOwnership(streamerId, liveSessionId);

    const messages = await db.orm.public.ChatMessage.where({
      liveSessionId,
    }).all();

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

  async startMonitoring(streamerId: string) {
    const connection = await db.orm.public.PlatformConnection.where({
      streamerId,
      platform: "youtube",
      isActive: true,
    }).first();

    if (!connection?.refreshToken) {
      throw new BadRequestException(
        "No active YouTube connection found. Please connect your YouTube account first.",
      );
    }

    const broadcast = await this.youtubeListener.findActiveBroadcast(
      connection.refreshToken,
    );
    if (!broadcast) {
      throw new BadRequestException(
        "No active live stream found on your YouTube channel.",
      );
    }

    const { broadcastId, liveChatId, title } = broadcast;

    let session = await db.orm.public.LiveSession.where({
      connectionId: connection.id,
      platformLiveId: broadcastId,
    }).first();

    if (!session) {
      const staleSessions = await db.orm.public.LiveSession.where({
        connectionId: connection.id,
        status: "live",
      }).all();

      for (const stale of staleSessions) {
        this.youtubeListener.stopListening(stale.id);
        await db.orm.public.LiveSession.where({ id: stale.id }).update({
          status: "ended",
          endedAt: new Date().toISOString(),
        });
      }

      session = await db.orm.public.LiveSession.create({
        connectionId: connection.id,
        platformLiveId: broadcastId,
        title,
        status: "live",
      });
    }

    if (!session) {
      throw new BadRequestException("Failed to create live session");
    }

    if (this.youtubeListener.isListening(session.id)) {
      return { session, message: "Already monitoring this session" };
    }

    const sessionId = session.id;

    await this.youtubeListener.startListening(
      sessionId,
      connection.refreshToken,
      liveChatId,
      async (connId: string, message: NormalizedChatMessage) => {
        await this.moderationQueue.add("process-message", {
          connectionId: connId,
          streamerId,
          liveSessionId: sessionId,
          liveChatId,
          message,
        } satisfies ModerationJobData);
      },
      connection.id,
    );

    return { session, message: "Monitoring started" };
  }

  async stopMonitoring(streamerId: string, liveSessionId: string) {
    const { session } = await this.assertOwnership(streamerId, liveSessionId);

    this.youtubeListener.stopListening(liveSessionId);

    await db.orm.public.LiveSession.where({ id: liveSessionId }).update({
      status: "ended",
      endedAt: new Date().toISOString(),
    });

    return { message: "Monitoring stopped" };
  }

  async getOverview(streamerId: string) {
    const connections = await db.orm.public.PlatformConnection.where({
      streamerId,
    }).all();
    const connectionIds = connections.map((c) => c.id);

    const sessionsPerConnection = await Promise.all(
      connectionIds.map((id) =>
        db.orm.public.LiveSession.where({ connectionId: id }).all(),
      ),
    );
    const allSessions = sessionsPerConnection.flat();

    const activeSession = allSessions.find((s) => s.status === "live") ?? null;

    let totalMessages = 0;
    let totalFlagged = 0;
    const actionBreakdown: Record<string, number> = {};

    for (const session of allSessions) {
      const messages = await db.orm.public.ChatMessage.where({
        liveSessionId: session.id,
      }).all();
      totalMessages += messages.length;

      for (const message of messages) {
        const actions = await db.orm.public.ModerationAction.where({
          chatMessageId: message.id,
        }).all();
        if (actions.length > 0) {
          totalFlagged++;
          for (const action of actions) {
            actionBreakdown[action.actionType] =
              (actionBreakdown[action.actionType] ?? 0) + 1;
          }
        }
      }
    }

    const rules = await db.orm.public.ModerationRule.where({
      streamerId,
    }).all();

    const recentSessions = [...allSessions]
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
      .slice(0, 5);

    return {
      totalSessions: allSessions.length,
      activeSession,
      totalMessages,
      totalFlagged,
      flaggedPercentage:
        totalMessages > 0 ? (totalFlagged / totalMessages) * 100 : 0,
      actionBreakdown,
      totalRules: rules.length,
      recentSessions,
    };
  }
}
