import { IsOptional, IsString } from "class-validator";

export class CustomerDetailsDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  company?: string | null;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsOptional()
  @IsString()
  gstin?: string | null;

  @IsString()
  contact: string;
}
