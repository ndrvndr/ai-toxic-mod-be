import { Queue } from "bullmq";

async function main() {
  const queue = new Queue("test-connection-queue", {
    connection: {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
  });

  const job = await queue.add("test-job", { message: "hello from bullmq" });
  console.log("Job added successfully! Job ID:", job.id);

  const jobCounts = await queue.getJobCounts();
  console.log("Queue job counts:", jobCounts);

  await queue.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to connect to Redis:", err.message);
  process.exit(1);
});
