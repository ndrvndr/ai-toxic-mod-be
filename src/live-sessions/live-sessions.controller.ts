import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";

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

  @Get("overview")
  async getOverview(@CurrentStreamer() streamerId: string) {
    const data = await this.liveSessionsService.getOverview(streamerId);
    return { data };
  }

  @Get("history")
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    schema: { default: 1 },
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    schema: { default: 10 },
  })
  @ApiQuery({ name: "search", required: false, type: String })
  async getHistory(
    @CurrentStreamer() streamerId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("search") search?: string,
  ) {
    return this.liveSessionsService.listPaginated(streamerId, {
      page,
      limit,
      search,
    });
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

  @Post("start-monitoring")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async startMonitoring(@CurrentStreamer() streamerId: string) {
    const data = await this.liveSessionsService.startMonitoring(streamerId);
    return { data };
  }

  @Post(":id/stop-monitoring")
  async stopMonitoring(
    @CurrentStreamer() streamerId: string,
    @Param("id") id: string,
  ) {
    const data = await this.liveSessionsService.stopMonitoring(streamerId, id);
    return { data };
  }
}
