import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module";
import { YouTubeListenerService } from "../platform-adapters/youtube/youtube-listener.service";
import { db } from "../prisma/db";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const listener = app.get(YouTubeListenerService);

  const connection = await db.orm.public.PlatformConnection.where({
    platform: "youtube",
  }).first();

  const liveSessionId = "ae8a283f-6df8-4166-8419-171279d8f9d7"; // Replace with your live session ID

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
      console.log(
        `[NEW MESSAGE] ${message.authorDisplayName}: ${message.text}`,
      );
    },
    connection.id,
  );
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
