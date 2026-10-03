import { IsIn, IsOptional } from "class-validator";
import { ListQueryDto } from "../../common/dto/list-query.dto";

export class InvoicesListQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(["invoiceDate", "totalAmount", "invoiceCode", "dueDate"])
  declare sortBy?: string;
}
