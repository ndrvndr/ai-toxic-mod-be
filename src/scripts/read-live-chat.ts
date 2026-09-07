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

  const liveChatId = process.env.TEST_LIVE_CHAT_ID;
  if (!liveChatId) throw new Error("TEST_LIVE_CHAT_ID not set in .env");

  const response = await youtube.liveChatMessages.list({
    liveChatId,
    part: ["snippet", "authorDetails"],
  });

  console.log("Polling interval (ms):", response.data.pollingIntervalMillis);
  console.log("Next page token:", response.data.nextPageToken);
  console.log("\nMessages:");

  for (const item of response.data.items ?? []) {
    console.log(
      `- [${item.authorDetails?.displayName}]: ${item.snippet?.textMessageDetails?.messageText}`,
    );
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
