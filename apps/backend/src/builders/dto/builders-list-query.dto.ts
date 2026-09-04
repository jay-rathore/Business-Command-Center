import { IsDateString, IsIn, IsOptional } from "class-validator";
import { ListQueryDto } from "../../common/dto/list-query.dto";

const COMPUTED_SORT_KEYS = [
  "projectsReferred",
  "leadsReferred",
  "sampleRequestsSent",
  "projectValue",
  "revenueInfluenced",
] as const;
export type BuilderComputedSortKey = (typeof COMPUTED_SORT_KEYS)[number];

export class BuildersListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(["name", "company", "city", "state", "joinedAt", ...COMPUTED_SORT_KEYS])
  declare sortBy?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export function isBuilderComputedSortKey(key: string | undefined): key is BuilderComputedSortKey {
  return !!key && (COMPUTED_SORT_KEYS as readonly string[]).includes(key);
}
