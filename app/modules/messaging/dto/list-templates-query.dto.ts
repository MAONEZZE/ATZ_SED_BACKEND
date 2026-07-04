import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@shared/pagination';

export class ListTemplatesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: "Filtra por evento vinculado. 'null' retorna só os templates globais.",
  })
  @IsOptional()
  @IsString()
  eventId?: string;
}
