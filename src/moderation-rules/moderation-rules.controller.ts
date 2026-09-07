import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { CurrentStreamer } from "../auth/current-streamer.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  ModerationRulesService,
  type CreateRuleInput,
  type UpdateRuleInput,
} from "./moderation-rules.service";

@Controller("moderation-rules")
@UseGuards(JwtAuthGuard)
export class ModerationRulesController {
  constructor(private rulesService: ModerationRulesService) {}

  @Get()
  async list(@CurrentStreamer() streamerId: string) {
    const data = await this.rulesService.list(streamerId);
    return { data };
  }

  @Post()
  async create(
    @CurrentStreamer() streamerId: string,
    @Body() body: CreateRuleInput,
  ) {
    const data = await this.rulesService.create(streamerId, body);
    return { data };
  }

  @Patch(":id")
  async update(
    @CurrentStreamer() streamerId: string,
    @Param("id") id: string,
    @Body() body: UpdateRuleInput,
  ) {
    const data = await this.rulesService.update(streamerId, id, body);
    return { data };
  }

  @Delete(":id")
  async remove(@CurrentStreamer() streamerId: string, @Param("id") id: string) {
    const data = await this.rulesService.delete(streamerId, id);
    return { data };
  }
}
