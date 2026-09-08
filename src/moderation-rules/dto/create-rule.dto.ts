import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsObject } from "class-validator";

export enum RuleTypeEnum {
  threshold = "threshold",
  blacklist_word = "blacklist_word",
  whitelist_word = "whitelist_word",
}

export enum ActionTypeEnum {
  none = "none",
  warn = "warn",
  delete = "delete",
  timeout = "timeout",
  ban = "ban",
}

export class CreateRuleDto {
  @ApiProperty({ enum: RuleTypeEnum, example: "blacklist_word" })
  @IsEnum(RuleTypeEnum)
  ruleType!: RuleTypeEnum;

  @ApiProperty({
    example: { word: "contoh" },
    description:
      'Untuk threshold: { threshold: 0.7 }. Untuk blacklist/whitelist: { word: "..." }',
  })
  @IsObject()
  @IsNotEmpty()
  value!: Record<string, unknown>;

  @ApiProperty({ enum: ActionTypeEnum, example: "delete" })
  @IsEnum(ActionTypeEnum)
  actionOnTrigger!: ActionTypeEnum;
}
