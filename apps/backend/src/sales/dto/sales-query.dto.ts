import { IsIn, IsOptional } from "class-validator";
import { ListQueryDto } from "../../common/dto/list-query.dto";

export class TrendQueryDto {
  @IsOptional()
  @IsIn(["daily", "weekly", "monthly"])
  granularity: "daily" | "weekly" | "monthly" = "monthly";
}

export class BreakdownQueryDto {
  @IsOptional()
  @IsIn(["product", "state", "dealer", "executive", "customer"])
  by: "product" | "state" | "dealer" | "executive" | "customer" = "product";
}

export class SalesTableQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(["sku", "name", "category", "units", "orders", "revenue", "growth", "contributionPct"])
  declare sortBy?: string;
}
