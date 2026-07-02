import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { OwnershipGuard } from '@shared/guards/ownership.guard';
import { CollaboratorsService } from '@modules/events/collaborators.service';
import { AddCollaboratorDto } from './dto/add-collaborator.dto';

@ApiTags('Collaborators')
@ApiBearerAuth()
@Controller('events/:eventId/collaborators')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class CollaboratorsController {
  constructor(private readonly collaborators: CollaboratorsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar colaboradores do evento' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 200, description: 'Lista de colaboradores com dados de perfil' })
  list(@Param('eventId') eventId: string) {
    return this.collaborators.list(eventId);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Adicionar colaborador por email (usuário já cadastrado)' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiResponse({ status: 201, description: 'Colaborador adicionado' })
  @ApiResponse({ status: 404, description: 'Nenhum usuário cadastrado com esse email' })
  @ApiResponse({ status: 409, description: 'Email pertence ao dono do evento' })
  add(@Param('eventId') eventId: string, @Body() dto: AddCollaboratorDto) {
    return this.collaborators.add(eventId, dto.email);
  }

  @Delete(':profileId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remover colaborador' })
  @ApiParam({ name: 'eventId', description: 'UUID do evento' })
  @ApiParam({ name: 'profileId', description: 'ID do perfil do colaborador' })
  @ApiResponse({ status: 204, description: 'Colaborador removido' })
  @ApiResponse({ status: 404, description: 'Colaborador não encontrado' })
  remove(@Param('eventId') eventId: string, @Param('profileId') profileId: string) {
    return this.collaborators.remove(eventId, profileId);
  }
}
