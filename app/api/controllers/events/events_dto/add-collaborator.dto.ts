import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class AddCollaboratorDto {
  @ApiProperty({ example: 'colab@empresa.com', description: 'Email de usuário já cadastrado' })
  @IsEmail()
  email!: string;
}
