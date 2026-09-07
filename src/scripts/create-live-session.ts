import { db } from "../prisma/db";

async function main() {
  const connection = await db.orm.public.PlatformConnection.where({
    platform: "youtube",
  }).first();

  if (!connection) throw new Error("No YouTube connection found");

  const broadcastId = process.env.TEST_BROADCAST_ID;
  if (!broadcastId) throw new Error("TEST_BROADCAST_ID not set in .env");

  const session = await db.orm.public.LiveSession.create({
    connectionId: connection.id,
    platformLiveId: broadcastId,
    title: "Testing",
    status: "live",
  });

  console.log("Created live session:", session);
}

main();
