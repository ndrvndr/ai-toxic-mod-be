import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentStreamer } from "../auth/current-streamer.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LiveSessionsService } from "./live-sessions.service";

@ApiTags("Live Sessions")
@ApiBearerAuth("access-token")
@Controller("live-sessions")
@UseGuards(JwtAuthGuard)
export class LiveSessionsController {
  constructor(private liveSessionsService: LiveSessionsService) {}

  @Get()
  async list(@CurrentStreamer() streamerId: string) {
    const data = await this.liveSessionsService.list(streamerId);
    return { data };
  }

  @Get(":id/messages")
  async getMessages(
    @CurrentStreamer() streamerId: string,
    @Param("id") id: string,
  ) {
    const data = await this.liveSessionsService.getMessages(streamerId, id);
    return { data };
  }

  @Get(":id/analytics")
  async getAnalytics(
    @CurrentStreamer() streamerId: string,
    @Param("id") id: string,
  ) {
    const data = await this.liveSessionsService.getAnalytics(streamerId, id);
    return { data };
  }
}
