import { db } from "../prisma/db";

const BLACKLIST_WORDS = [
  "tolol",
  "goblok",
  "bego",
  "bangsat",
  "anjing",
  "kontol",
  "memek",
  "bajingan",
  "idiot",
  "stupid",
];

async function main() {
  const streamer = await db.orm.public.Streamer.where({
    email: "andreavindra37@gmail.com",
  }).first();

  if (!streamer) throw new Error("Test streamer not found");

  for (const word of BLACKLIST_WORDS) {
    await db.orm.public.ModerationRule.create({
      streamerId: streamer.id,
      ruleType: "blacklist_word",
      value: { word },
      actionOnTrigger: "delete",
      isActive: true,
    });
    console.log(`Added blacklist word: ${word}`);
  }

  console.log("\nDone seeding blacklist words.");
}

main();
