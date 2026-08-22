import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@api/dto/shared/pagination';

export class ListFormFieldsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtra os campos de um formulário do evento. Ausente = todos os campos do evento.',
  })
  @IsOptional()
  @IsUUID()
  formId?: string;
}
