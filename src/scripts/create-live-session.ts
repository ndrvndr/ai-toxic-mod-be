import { db } from "../prisma/db";

async function main() {
  const connection = await db.orm.public.PlatformConnection.where({
    platform: "youtube",
  }).first();

  if (!connection) throw new Error("No YouTube connection found");

  const session = await db.orm.public.LiveSession.create({
    connectionId: connection.id,
    platformLiveId: "H1SM9xJ1QSA", // Use the previous broadcast ID; change it only for a new live stream.
    title: "Testing",
    status: "live",
  });

  console.log("Created live session:", session);
}

main();
