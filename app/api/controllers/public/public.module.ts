import { Module } from '@nestjs/common';
import { PublicRegistrationsController } from './public-registrations.controller';
import { PublicEventsController } from './public-events.controller';
import { RegistrationsModule } from '../registrations/registrations.module';

@Module({
  imports: [RegistrationsModule],
  controllers: [PublicRegistrationsController, PublicEventsController],
})
export class PublicModule {}
