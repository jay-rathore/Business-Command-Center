import { IsEnum, IsString, MinLength } from "class-validator";
import { QuotationInputMode } from "@prisma/client";

export class ParseQuotationTextDto {
  @IsString()
  @MinLength(3)
  text: string;

  @IsEnum(QuotationInputMode)
  mode: typeof QuotationInputMode.CHAT_AI | typeof QuotationInputMode.VOICE_AI;
}
