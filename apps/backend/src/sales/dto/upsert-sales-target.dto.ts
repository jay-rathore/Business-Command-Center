import { SalesTargetScope, TargetPeriodType } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpsertSalesTargetDto {
  @IsEnum(SalesTargetScope)
  scope: SalesTargetScope;

  @IsOptional()
  @IsString()
  salesExecutiveId?: string;

  @IsOptional()
  @IsString()
  dealerId?: string;

  @IsOptional()
  @IsString()
  productCategoryId?: string;

  @IsEnum(TargetPeriodType)
  periodType: TargetPeriodType;

  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;

  @IsNumber()
  @Min(0)
  targetRevenue: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  targetOrders?: number;
}
