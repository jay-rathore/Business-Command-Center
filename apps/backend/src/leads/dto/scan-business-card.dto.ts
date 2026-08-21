import { IsString, MinLength } from "class-validator";

export class ScanBusinessCardDto {
  // A "data:image/...;base64,...." URL — the exact shape is validated in
  // BusinessCardAiParserService, not here, since the data-URL prefix breaks @IsBase64.
  @IsString()
  @MinLength(1)
  imageDataUrl: string;
}
