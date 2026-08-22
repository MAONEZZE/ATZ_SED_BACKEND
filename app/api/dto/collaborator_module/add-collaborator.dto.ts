import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional } from 'class-validator';
import { EventRole } from '@domain/collaborator_module/event-role.type';

const ROLES: EventRole[] = ['admin', 'invited', 'read'];

export class AddCollaboratorDto {
  @ApiProperty({ example: 'colab@empresa.com', description: 'Email de usuário já cadastrado' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    enum: ROLES,
    default: 'invited',
    description:
      'admin = tudo no evento; invited = edita tudo, mas deletar só o desvincula; read = só leitura.',
  })
  @IsOptional()
  @IsIn(ROLES)
  role?: EventRole;
}

export class UpdateCollaboratorRoleDto {
  @ApiProperty({ enum: ROLES, example: 'read' })
  @IsIn(ROLES)
  role!: EventRole;
}
