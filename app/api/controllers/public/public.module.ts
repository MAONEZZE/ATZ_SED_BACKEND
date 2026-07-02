import { Module } from '@nestjs/common';
import { PublicRegistrationsController } from './public_routes/public-registrations.controller';
import { PublicEventsController } from './public_routes/public-events.controller';
import { PublicPostEventController } from './public_routes/public-post-event.controller';
import { PublicNpsController } from './public_routes/public-nps.controller';
import { PublicEventsService } from '@services/events/public-events.service';
import { RegistrationsModule } from '../registrations/registrations.module';

@Module({
  imports: [RegistrationsModule],
  controllers: [
    PublicRegistrationsController,
    PublicEventsController,
    PublicPostEventController,
    PublicNpsController,
  ],
  providers: [PublicEventsService],
})
export class PublicModule {}
