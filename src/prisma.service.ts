import { Injectable } from "@nestjs/common";

import { db } from "./prisma/db";

@Injectable()
export class PrismaService {
  readonly db = db;
}
