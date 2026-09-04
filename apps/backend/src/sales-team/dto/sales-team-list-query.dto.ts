import { IsDateString, IsIn, IsOptional } from "class-validator";
import { ListQueryDto } from "../../common/dto/list-query.dto";

const COMPUTED_SORT_KEYS = [
  "revenue",
  "orders",
  "leadsAssigned",
  "leadsWon",
  "conversionRate",
  "targetRevenue",
  "achievementPct",
  "overdueFollowUps",
] as const;
export type SalesTeamComputedSortKey = (typeof COMPUTED_SORT_KEYS)[number];

export class SalesTeamListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(["name", "designation", "state", ...COMPUTED_SORT_KEYS])
  declare sortBy?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export function isSalesTeamComputedSortKey(key: string | undefined): key is SalesTeamComputedSortKey {
  return !!key && (COMPUTED_SORT_KEYS as readonly string[]).includes(key);
}
