import { Module } from '@nestjs/common';
import { PublicRegistrationsController } from './public-registrations.controller';
import { PublicEventsController } from './public-events.controller';
import { PublicPostEventController } from './public-post-event.controller';
import { PublicNpsController } from './public-nps.controller';
import { PublicEventsService } from '@modules/events/public-events.service';
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
