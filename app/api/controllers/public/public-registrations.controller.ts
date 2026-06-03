import { Controller, Post, Param, Body } from '@nestjs/common';
import { RegistrationsService } from '@services/registrations/registrations.service';

@Controller('public/events')
export class PublicRegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Post(':slug/registrations')
  create(
    @Param('slug') slug: string,
    @Body() answers: Record<string, unknown>,
  ) {
    return this.registrations.createPublic(slug, answers);
  }
}
