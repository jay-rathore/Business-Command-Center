import { IsIn, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "../../common/dto/list-query.dto";

const COMPUTED_SORT_KEYS = ["units", "orders", "revenue", "growth"] as const;
export type ComputedSortKey = (typeof COMPUTED_SORT_KEYS)[number];

export class ProductsListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsIn(["name", "sku", "category", ...COMPUTED_SORT_KEYS])
  declare sortBy?: string;
}

export function isComputedSortKey(key: string | undefined): key is ComputedSortKey {
  return !!key && (COMPUTED_SORT_KEYS as readonly string[]).includes(key);
}
