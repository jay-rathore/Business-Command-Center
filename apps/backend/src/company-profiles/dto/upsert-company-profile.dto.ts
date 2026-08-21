import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpsertCompanyProfileDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsString()
  name: string;

  @IsString()
  addressLine1: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  gstin: string;

  @IsOptional()
  @IsString()
  logoDataUrl?: string;

  @IsString()
  bankName: string;

  @IsString()
  bankAccountNumber: string;

  @IsString()
  bankIfsc: string;

  @IsOptional()
  @IsString()
  bankSwift?: string;

  @IsString()
  defaultTermsAndConditions: string;

  @IsInt()
  @Min(0)
  @Max(100)
  defaultAdvancePercent: number;

  @IsInt()
  @Min(0)
  @Max(100)
  defaultBeforeDispatchPercent: number;

  @IsInt()
  @Min(1)
  validityDays: number;
}
