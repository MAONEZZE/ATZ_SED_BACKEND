import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRegistrationAnswersDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { Nome: 'João Silva', 'E-mail': 'joao@example.com', Telefone: '11999999999' },
  })
  @IsObject()
  answers!: Record<string, unknown>;
}
