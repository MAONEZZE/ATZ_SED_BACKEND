import { IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitNpsDto {
  @ApiProperty({ example: 'joao@email.com', description: 'Email ou telefone do inscrito' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ example: { 'Nota (0-10)': '9', Fotos: ['https://.../foto1.jpg'] } })
  @IsObject()
  answers!: Record<string, unknown>;
}
