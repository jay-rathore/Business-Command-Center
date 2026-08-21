import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import { QuotationInputMode } from "@prisma/client";
import { CustomerDetailsDto } from "./customer-details.dto";
import { QuotationItemInputDto } from "./quotation-item-input.dto";

export class CreateQuotationDto {
  @IsString()
  companyProfileId: string;

  @ValidateNested()
  @Type(() => CustomerDetailsDto)
  customer: CustomerDetailsDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuotationItemInputDto)
  items: QuotationItemInputDto[];

  @IsInt()
  @Min(0)
  @Max(100)
  advancePercent: number;

  @IsInt()
  @Min(0)
  @Max(100)
  beforeDispatchPercent: number;

  @IsString()
  termsAndConditions: string;

  @IsDateString()
  validUntil: string;

  @IsEnum(QuotationInputMode)
  inputMode: QuotationInputMode;

  @IsOptional()
  @IsString()
  rawInputText?: string | null;
}
