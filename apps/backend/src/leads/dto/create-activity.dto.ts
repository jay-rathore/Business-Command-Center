import { IsEnum, IsOptional, IsString } from "class-validator";
import { ActivityType } from "@prisma/client";

export class CreateLeadActivityDto {
  @IsEnum(ActivityType)
  type: ActivityType;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  newStatusId?: string;
}
