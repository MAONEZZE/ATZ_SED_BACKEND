import { IsOptional, IsIn, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@api/dto/shared/pagination';
import { FunnelStatus } from '@domain/registration_module/registration.entity';

export class ListRegistrationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['pending', 'approved', 'rejected'] })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  status?: FunnelStatus;

  @ApiPropertyOptional({ description: 'Busca por nome ou email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtra por formulário de origem (originFormId)' })
  @IsOptional()
  @IsString()
  formId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Filtra por presença. Ausente = todos.',
  })
  @IsOptional()
  // A query string carrega string: 'true'/'false' viram boolean antes do validador.
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  attended?: boolean;

  @ApiPropertyOptional({ enum: ['json', 'csv'] })
  @IsOptional()
  @IsIn(['json', 'csv'])
  format?: 'json' | 'csv';
}
