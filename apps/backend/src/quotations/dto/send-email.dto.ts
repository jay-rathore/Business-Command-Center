import { IsEmail, IsOptional } from "class-validator";

export class SendEmailDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}
