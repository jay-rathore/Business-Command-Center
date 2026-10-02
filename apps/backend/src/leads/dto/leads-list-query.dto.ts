import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "../../common/dto/list-query.dto";

export class LeadsListQueryDto extends ListQueryDto {
  // LeadStatus is now a dynamic lookup table, not a fixed enum, so this is validated as a
  // plain id (the service silently returns no matches for an unknown id, same as any other
  // free-form filter) rather than an IsIn(Object.values(...)) whitelist.
  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @IsIn(["name", "company", "createdAt", "nextFollowUpAt", "score", "estimatedValue"])
  declare sortBy?: string;

  // Leads that came from this source (a lead can have several).
  @IsOptional()
  @IsString()
  sourceId?: string;

  // Filters to every status in a stage (e.g. all lost leads), independent of statusId.
  @IsOptional()
  @IsIn(["OPEN", "WON", "LOST"])
  stage?: "OPEN" | "WON" | "LOST";

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
