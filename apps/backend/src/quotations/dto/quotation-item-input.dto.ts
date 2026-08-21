import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class QuotationItemInputDto {
  @IsOptional()
  @IsString()
  productId?: string | null;

  @IsString()
  itemName: string;

  @IsOptional()
  @IsString()
  hsnCode?: string | null;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitRate: number;

  @IsNumber()
  @Min(0)
  taxPercent: number;
}
