import { IsIn, IsOptional } from "class-validator";
import { ProjectStage } from "@prisma/client";
import { ListQueryDto } from "../../common/dto/list-query.dto";

export class ProjectsListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(Object.values(ProjectStage))
  stage?: ProjectStage;

  @IsOptional()
  @IsIn(["name", "estimatedValue", "probability", "expectedCloseAt", "stageSince"])
  declare sortBy?: string;
}
