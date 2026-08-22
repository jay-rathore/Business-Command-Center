import { IsIn, IsOptional } from "class-validator";
import { CampaignPlatform, CampaignStatus } from "@prisma/client";
import { ListQueryDto } from "../../common/dto/list-query.dto";

export class MarketingListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(Object.values(CampaignPlatform))
  platform?: CampaignPlatform;

  @IsOptional()
  @IsIn(Object.values(CampaignStatus))
  status?: CampaignStatus;

  @IsOptional()
  @IsIn(["name", "spend", "leadsCount", "startDate", "createdAt"])
  declare sortBy?: string;
}
