import { db } from "../prisma/db";

async function main() {
  const streamer = await db.orm.public.Streamer.create({
    email: "test@example.com",
    displayName: "Test Streamer",
  });

  console.log("Created streamer:", streamer);
}

main();
