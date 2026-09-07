import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { YouTubeModule } from "./platform-adapters/youtube/youtube.module";
import { PrismaService } from "./prisma.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    YouTubeModule,
  ],
  controllers: [AppController],
  providers: [PrismaService],
})
export class AppModule {}
