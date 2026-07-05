import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '@shared/pagination';

export class ListFormFieldsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['registration', 'post_event', 'nps'] })
  @IsOptional()
  @IsIn(['registration', 'post_event', 'nps'])
  kind?: 'registration' | 'post_event' | 'nps';
}
