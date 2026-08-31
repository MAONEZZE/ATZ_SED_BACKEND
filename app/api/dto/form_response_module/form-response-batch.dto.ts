import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteFormResponsesDto {
  @ApiProperty({
    example: ['uuid-resposta-1', 'uuid-resposta-2'],
    description:
      'Ids das respostas (FormResponse.id, não registrationId) a apagar. Máximo 500 por requisição.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids!: string[];
}
