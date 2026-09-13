import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import Redis from "ioredis";

export interface JwtPayload {
  streamerId: string;
  email: string;
  jti: string;
}

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  private redis: Redis;

  constructor(private jwtService: JwtService) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST ?? "localhost",
      port: Number(process.env.REDIS_PORT ?? 6379),
    });
  }

  async generateToken(payload: Omit<JwtPayload, "jti">): Promise<string> {
    const jti = randomUUID();
    const token = this.jwtService.sign({ ...payload, jti });

    await this.redis.set(
      `session:${jti}`,
      payload.streamerId,
      "EX",
      SESSION_TTL_SECONDS,
    );

    return token;
  }

  verifyToken(token: string): JwtPayload {
    return this.jwtService.verify(token);
  }

  async isSessionActive(jti: string): Promise<boolean> {
    const exists = await this.redis.exists(`session:${jti}`);
    return exists === 1;
  }

  async revokeSession(jti: string): Promise<void> {
    await this.redis.del(`session:${jti}`);
  }
}
