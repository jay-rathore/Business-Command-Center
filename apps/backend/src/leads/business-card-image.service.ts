import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const UPLOAD_DIR = join(process.cwd(), "uploads", "business-cards");

/** Optionally persists a scanned business card image to local disk, following the same
 * uploads/<subfolder>/<key>.<ext> convention as QuotationPdfService. Called only when the
 * scanning user opts in via the "save image" toggle on the review step. */
@Injectable()
export class BusinessCardImageService {
  private readonly logger = new Logger(BusinessCardImageService.name);

  save(leadId: string, imageDataUrl: string): string {
    const match = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(imageDataUrl);
    if (!match) throw new BadRequestException("Invalid image data");
    const [, rawExt, base64] = match;
    const ext = rawExt === "jpeg" ? "jpg" : rawExt;

    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
    const filePath = join(UPLOAD_DIR, `${leadId}.${ext}`);
    writeFileSync(filePath, Buffer.from(base64, "base64"));
    this.logger.log(`Saved business card image at ${filePath}`);
    return filePath;
  }
}
