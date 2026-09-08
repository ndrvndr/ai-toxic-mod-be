import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsObject, IsOptional } from "class-validator";

import { ActionTypeEnum } from "./create-rule.dto";

export class UpdateRuleDto {
  @ApiPropertyOptional({ example: { threshold: 0.5 } })
  @IsObject()
  @IsOptional()
  value?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ActionTypeEnum })
  @IsEnum(ActionTypeEnum)
  @IsOptional()
  actionOnTrigger?: ActionTypeEnum;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
