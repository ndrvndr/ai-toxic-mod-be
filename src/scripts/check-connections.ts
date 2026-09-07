import { db } from "../prisma/db";

async function main() {
  const connections = await db.orm.public.PlatformConnection.where({}).all();
  console.log(JSON.stringify(connections, null, 2));
}

main();
