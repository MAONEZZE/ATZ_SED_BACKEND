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
    description: 'Telefone do inscrito. Normalizado antes de casar com a inscrição.',
  })
  @IsString()
  phone!: string;
}
