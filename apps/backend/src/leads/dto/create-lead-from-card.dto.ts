import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateLeadFromCardDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  company?: string | null;

  @IsString()
  @MinLength(3)
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  website?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsString()
  state: string;

  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  leadTypeId?: string | null;

  @IsOptional()
  @IsString()
  assignedExecId?: string | null;

  @IsOptional()
  @IsString()
  statusId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsBoolean()
  saveImage: boolean;

  // Re-sent by the client alongside saveImage=true — the scan/extract step never persists the
  // image server-side, so it has to round-trip back on the create call.
  @IsOptional()
  @IsString()
  imageDataUrl?: string | null;
}
