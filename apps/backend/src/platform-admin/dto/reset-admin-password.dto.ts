import { IsOptional, IsString, MinLength } from "class-validator";

export class ResetAdminPasswordDto {
  // Optional — leave unset to auto-generate a random one-time password (the default).
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
