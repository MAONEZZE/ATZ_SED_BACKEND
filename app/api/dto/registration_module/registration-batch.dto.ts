import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteRegistrationsDto {
  @ApiProperty({
    example: ['uuid-inscricao-1', 'uuid-inscricao-2'],
    description: 'Ids das inscrições a apagar. Máximo 500 por requisição.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids!: string[];
}

export class SetAttendanceDto {
  @ApiProperty({ example: ['uuid-inscricao-1'], description: 'Máximo 500 por requisição.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids!: string[];

  @ApiProperty({ example: true, description: 'true = compareceu; false = desfaz a marcação.' })
  @IsBoolean()
  attended!: boolean;
}

export class CheckInDto {
  @ApiProperty({
    example: '11999998888',
    description:
      'Telefone do inscrito, com ou sem máscara/`55`/nono dígito. É a única entrada: o evento é resolvido pela data mais próxima de hoje.',
  })
  @IsString()
  phone!: string;
}
