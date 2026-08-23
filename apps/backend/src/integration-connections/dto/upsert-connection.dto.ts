import { IsBoolean, IsEnum, IsNotEmptyObject, IsObject, IsOptional } from "class-validator";
import { IntegrationProvider } from "@prisma/client";

export class UpsertConnectionDto {
  @IsEnum(IntegrationProvider)
  provider: IntegrationProvider;

  // Shape depends on `provider` — see credential-types.ts. Validated loosely here; the sync
  // services are what actually depend on the right fields being present.
  @IsObject()
  @IsNotEmptyObject()
  credentials: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
