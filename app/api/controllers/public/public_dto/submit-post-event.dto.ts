import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitPostEventDto {
  @ApiProperty({ example: 'joao@email.com', description: 'Email ou telefone do inscrito' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ example: { 'Como avalia o evento?': 'Ótimo' } })
  @IsObject()
  answers!: Record<string, unknown>;
}
