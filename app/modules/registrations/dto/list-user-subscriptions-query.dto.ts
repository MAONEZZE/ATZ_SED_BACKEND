import { IsOptional, IsIn, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@shared/pagination';

export class ListUserSubscriptionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome, email ou telefone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['json', 'csv'] })
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}
