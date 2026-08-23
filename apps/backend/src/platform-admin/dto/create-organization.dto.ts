import { IsEmail, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: "slug must be lowercase letters, numbers, and hyphens only" })
  slug: string;

  @IsString()
  @MinLength(1)
  adminName: string;

  @IsEmail()
  adminEmail: string;

  // Optional — leave unset to auto-generate a random one-time password (the default).
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
