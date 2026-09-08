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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentStreamer } from "../auth/current-streamer.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateRuleDto } from "./dto/create-rule.dto";
import { UpdateRuleDto } from "./dto/update-rule.dto";
import { ModerationRulesService } from "./moderation-rules.service";

@ApiTags("Moderation Rules")
@ApiBearerAuth("access-token")
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
    @Body() body: CreateRuleDto,
  ) {
    const data = await this.rulesService.create(streamerId, body);
    return { data };
  }

  @Patch(":id")
  async update(
    @CurrentStreamer() streamerId: string,
    @Param("id") id: string,
    @Body() body: UpdateRuleDto,
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
