import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { CollaboratorsService } from '@services/events/collaborators.service';
import { AddCollaboratorDto } from '../events_dto/add-collaborator.dto';

@ApiTags('Collaborators')
@ApiBearerAuth()
@Controller('events/:id/collaborators')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class CollaboratorsController {
  constructor(private readonly collaborators: CollaboratorsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar colaboradores do evento' })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Lista de colaboradores com dados de perfil' })
  list(@Param('id') eventId: string) {
    return this.collaborators.list(eventId);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Adicionar colaborador por email (usuário já cadastrado)' })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiResponse({ status: 201, description: 'Colaborador adicionado' })
  @ApiResponse({ status: 404, description: 'Nenhum usuário cadastrado com esse email' })
  @ApiResponse({ status: 409, description: 'Email pertence ao dono do evento' })
  add(@Param('id') eventId: string, @Body() dto: AddCollaboratorDto) {
    return this.collaborators.add(eventId, dto.email);
  }

  @Delete(':profileId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remover colaborador' })
  @ApiParam({ name: 'id', description: 'UUID do evento' })
  @ApiParam({ name: 'profileId', description: 'ID do perfil do colaborador' })
  @ApiResponse({ status: 204, description: 'Colaborador removido' })
  @ApiResponse({ status: 404, description: 'Colaborador não encontrado' })
  remove(@Param('id') eventId: string, @Param('profileId') profileId: string) {
    return this.collaborators.remove(eventId, profileId);
  }
}
