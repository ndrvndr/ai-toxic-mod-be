import { Queue } from "bullmq";

async function main() {
  const queue = new Queue("moderation-queue", {
    connection: {
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
  });

  const counts = await queue.getJobCounts();
  console.log("Job counts:", counts);

  const failedJobs = await queue.getFailed();
  for (const job of failedJobs) {
    console.log("\n--- FAILED JOB ---");
    console.log("Data:", JSON.stringify(job.data, null, 2));
    console.log("Failed reason:", job.failedReason);
    console.log("Stack:", job.stacktrace);
  }

  const completedJobs = await queue.getCompleted();
  console.log("\nCompleted jobs count:", completedJobs.length);

  await queue.close();
  process.exit(0);
}

main();
