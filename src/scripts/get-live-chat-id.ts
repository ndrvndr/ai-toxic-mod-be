import "dotenv/config";
import { google } from "googleapis";

import { db } from "../prisma/db";

async function main() {
  const connection = await db.orm.public.PlatformConnection.where({
    platform: "youtube",
  }).first();

  if (!connection) {
    throw new Error("No YouTube connection found");
  }

  const client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI,
  );

  client.setCredentials({
    refresh_token: connection.refreshToken,
  });

  const youtube = google.youtube({ version: "v3", auth: client });

  const response = await youtube.liveBroadcasts.list({
    part: ["snippet", "status"],
    broadcastStatus: "active",
    broadcastType: "all",
  });

  console.log(
    "Active broadcasts:",
    JSON.stringify(response.data.items, null, 2),
  );

  const liveChatId = response.data.items?.[0]?.snippet?.liveChatId;
  console.log("\nliveChatId:", liveChatId ?? "NOT FOUND");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
