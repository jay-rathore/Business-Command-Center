import { IsIn, IsOptional } from "class-validator";
import { ListQueryDto } from "../../common/dto/list-query.dto";

export class QuotationsListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(["quotationDate", "totalAmount", "quotationCode"])
  declare sortBy?: string;
}
