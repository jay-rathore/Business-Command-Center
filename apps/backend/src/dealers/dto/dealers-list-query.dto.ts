import { IsIn, IsOptional, IsString } from "class-validator";
import { DealerStatus } from "@prisma/client";
import { ListQueryDto } from "../../common/dto/list-query.dto";

const COMPUTED_SORT_KEYS = ["totalOrders", "revenue", "growth", "healthScore"] as const;
export type DealerComputedSortKey = (typeof COMPUTED_SORT_KEYS)[number];

export class DealersListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(Object.values(DealerStatus))
  status?: DealerStatus;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsIn(["name", "dealerCode", "state", "joinedAt", ...COMPUTED_SORT_KEYS])
  declare sortBy?: string;
}

export function isDealerComputedSortKey(key: string | undefined): key is DealerComputedSortKey {
  return !!key && (COMPUTED_SORT_KEYS as readonly string[]).includes(key);
}
