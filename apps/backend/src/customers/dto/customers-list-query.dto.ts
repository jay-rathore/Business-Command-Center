import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import { CustomerType } from "@prisma/client";
import type { CustomerSegment } from "@hpl/shared";
import { ListQueryDto } from "../../common/dto/list-query.dto";

const SEGMENTS: CustomerSegment[] = ["NEW", "ACTIVE", "AT_RISK", "DORMANT"];
const COMPUTED_SORT_KEYS = ["segment"] as const;
export type CustomerComputedSortKey = (typeof COMPUTED_SORT_KEYS)[number];

export class CustomersListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(SEGMENTS)
  segment?: CustomerSegment;

  @IsOptional()
  @IsIn(Object.values(CustomerType))
  type?: CustomerType;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsIn(["name", "city", "state", "lifetimeValue", "lastPurchaseAt", "createdAt", ...COMPUTED_SORT_KEYS])
  declare sortBy?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export function isCustomerComputedSortKey(key: string | undefined): key is CustomerComputedSortKey {
  return !!key && (COMPUTED_SORT_KEYS as readonly string[]).includes(key);
}
