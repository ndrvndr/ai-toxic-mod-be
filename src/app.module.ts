import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { LiveSessionsModule } from "./live-sessions/live-sessions.module";
import { ModerationRulesModule } from "./moderation-rules/moderation-rules.module";
import { YouTubeModule } from "./platform-adapters/youtube/youtube.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QueueModule } from "./queue/queue.module";
import { WebsocketModule } from "./websocket/websocket.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>("REDIS_HOST", "localhost"),
          port: config.get<number>("REDIS_PORT", 6379),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    YouTubeModule,
    QueueModule,
    AuthModule,
    ModerationRulesModule,
    LiveSessionsModule,
    WebsocketModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
