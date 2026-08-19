import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

function HasPhoneOrEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'hasPhoneOrEmail',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const item = args.object as ImportRegistrationItemDto;
          return Boolean(item.telefone?.trim() || item.email?.trim());
        },
        defaultMessage() {
          return 'Informe ao menos telefone ou email';
        },
      },
    });
  };
}

export class ImportRegistrationItemDto {
  @ApiProperty({ example: 'Fulano da Silva' })
  @IsString()
  @IsNotEmpty()
  @HasPhoneOrEmail()
  nome!: string;

  @ApiPropertyOptional({ example: '(11) 91234-5678' })
  @IsOptional()
  @IsString()
  telefone?: string;

  @ApiPropertyOptional({ example: 'fulano@example.com' })
  @IsOptional()
  @IsString()
  email?: string;
}

export class ImportRegistrationsDto {
  @ApiProperty({
    example: 'uuid-do-formulario',
    description: 'Formulário de origem dos inscritos importados. Tem que ser do próprio evento.',
  })
  @IsUUID()
  formId!: string;

  @ApiProperty({ type: [ImportRegistrationItemDto], description: 'Máximo 500 por requisição.' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportRegistrationItemDto)
  registrations!: ImportRegistrationItemDto[];
}
