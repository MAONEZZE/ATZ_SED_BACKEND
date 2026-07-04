import { IsOptional, IsIn, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@shared/pagination';
import { FunnelStatus } from '@modules/registrations/entities/registration.entity';

export class ListRegistrationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected'] })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: FunnelStatus;

  @ApiPropertyOptional({ description: 'Busca por nome ou email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['json', 'csv'] })
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}
