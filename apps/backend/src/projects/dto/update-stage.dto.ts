import { IsIn, IsOptional, IsString } from "class-validator";
import { ProjectStage } from "@prisma/client";

export class UpdateProjectStageDto {
  @IsIn(Object.values(ProjectStage))
  toStage: ProjectStage;

  @IsOptional()
  @IsString()
  note?: string;
}
