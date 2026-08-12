import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
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
  nome!: string;

  @ApiPropertyOptional({ example: '(11) 91234-5678' })
  @IsOptional()
  @IsString()
  @HasPhoneOrEmail()
  telefone?: string;

  @ApiPropertyOptional({ example: 'fulano@example.com' })
  @IsOptional()
  @IsString()
  email?: string;
}

export class ImportRegistrationsDto {
  @ApiProperty({ type: [ImportRegistrationItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportRegistrationItemDto)
  registrations!: ImportRegistrationItemDto[];
}
