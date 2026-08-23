import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class InvestigateTrafficDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  question?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
