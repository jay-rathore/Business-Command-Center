import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class InvoiceItemDto {
  /** The quotation line this one came from — lets the invoice show what was originally offered. */
  @IsOptional()
  @IsString()
  quotationItemId?: string | null;

  @IsOptional()
  @IsString()
  productId?: string | null;

  @IsString()
  @MaxLength(300)
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
  @Max(100)
  taxPercent: number;
}

/** Used for both creating an invoice from a quotation and editing it before it is sent. */
export class SaveInvoiceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsInt()
  @Min(0)
  @Max(100)
  advancePercent: number;

  @IsInt()
  @Min(0)
  @Max(100)
  beforeDispatchPercent: number;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  negotiationNote?: string | null;

  @IsOptional()
  @IsString()
  termsAndConditions?: string | null;
}
