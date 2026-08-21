import { IsOptional, IsString } from "class-validator";

export class SendWhatsAppDto {
  @IsOptional()
  @IsString()
  phone?: string;
}
