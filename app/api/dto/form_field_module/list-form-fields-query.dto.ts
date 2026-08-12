import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@api/dto/shared/pagination';
import { FORM_KINDS, FormKind } from '@domain/shared/form-kind.type';

export class ListFormFieldsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FORM_KINDS })
  @IsOptional()
  @IsIn(FORM_KINDS)
  kind?: FormKind;
}
