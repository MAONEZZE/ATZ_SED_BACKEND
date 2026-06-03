import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { GuardsModule } from '@api/config/guards/guards.module';

@Module({
  imports: [GuardsModule],
  controllers: [MessagingController],
})
export class MessagingModule {}
