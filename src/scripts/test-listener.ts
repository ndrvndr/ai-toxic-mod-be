import { getQueueToken } from "@nestjs/bullmq";
import { NestFactory } from "@nestjs/core";
import type { Queue } from "bullmq";

import { AppModule } from "../app.module";
import { YouTubeListenerService } from "../platform-adapters/youtube/youtube-listener.service";
import { db } from "../prisma/db";
import type { ModerationJobData } from "../queue/moderation.processor";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const listener = app.get(YouTubeListenerService);
  const queue = app.get<Queue<ModerationJobData>>(
    getQueueToken("moderation-queue"),
  );

  const connection = await db.orm.public.PlatformConnection.where({
    platform: "youtube",
  }).first();

  const liveSessionId = process.env.TEST_LIVE_SESSION_ID;
  if (!liveSessionId) throw new Error("TEST_LIVE_SESSION_ID not set in .env");

  if (!connection?.refreshToken) throw new Error("No refresh token");

  const liveChatId = await listener.findActiveLiveChatId(
    connection.refreshToken,
  );
  if (!liveChatId) throw new Error("No active live chat found");

  console.log("Found liveChatId:", liveChatId);
  console.log("Starting to listen... (Ctrl+C to stop)");

  await listener.startListening(
    liveSessionId,
    connection.refreshToken,
    liveChatId,
    async (connectionId, message) => {
      console.log(`[QUEUEING] ${message.authorDisplayName}: ${message.text}`);
      await queue.add("process-message", {
        connectionId,
        streamerId: connection.streamerId,
        liveSessionId,
        liveChatId,
        message,
      } satisfies ModerationJobData);
    },
    connection.id,
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
