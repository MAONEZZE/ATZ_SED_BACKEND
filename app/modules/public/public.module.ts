import { Module } from '@nestjs/common';
import { PublicRegistrationsController } from './public-registrations.controller';
import { PublicEventsController } from './public-events.controller';
import { PublicPostEventController } from './public-post-event.controller';
import { PublicNpsController } from './public-nps.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { PublicEventsService } from '@modules/events/public-events.service';
import { RegistrationsModule } from '../registrations/registrations.module';
import { MessagingDbModule } from '@modules/messaging/messaging-db.module';
import { EventsDbModule } from '@modules/events/events-db.module';

@Module({
  imports: [RegistrationsModule, MessagingDbModule, EventsDbModule],
  controllers: [
    PublicRegistrationsController,
    PublicEventsController,
    PublicPostEventController,
    PublicNpsController,
    WhatsappWebhookController,
  ],
  providers: [PublicEventsService],
})
export class PublicModule {}
