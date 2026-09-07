import { Queue } from "bullmq";

async function main() {
  const queue = new Queue("moderation-queue", {
    connection: {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
  });

  await queue.clean(0, 1000, "failed");
  console.log("Cleaned failed jobs");

  await queue.close();
  process.exit(0);
}

main();
