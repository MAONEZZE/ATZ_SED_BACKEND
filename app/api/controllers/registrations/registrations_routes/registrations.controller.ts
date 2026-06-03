import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { CurrentUser } from '@api/config/decorators/current-user.decorator';
import { AuthenticatedUser } from '@domain/users/entities/authenticated-user.entity';
import { RegistrationsService } from '@services/registrations/registrations.service';
import { FunnelStatus } from '@domain/registrations/entities/registration.entity';
import { UpdateRegistrationStatusDto } from '../registrations_dto/update-registration-status.dto';

@Controller('events/:eventId/registrations')
@UseGuards(JwtAuthGuard, OwnershipGuard)
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get()
  findAll(
    @Param('eventId') eventId: string,
    @Query('status') status?: FunnelStatus,
  ) {
    return this.registrations.findAll(eventId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.registrations.findById(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRegistrationStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrations.updateStatus(id, dto.status, user.id);
  }
}
