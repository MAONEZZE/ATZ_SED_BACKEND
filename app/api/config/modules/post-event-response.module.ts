import { Module } from '@nestjs/common';
import { PostEventResponseController } from '@api/controllers/post_event_response_module/post-event-response.controller';
import { PostEventResponseService } from '@application/post_event_response_module/post-event-response.service';
import { PostEventResponseDbModule } from '@infra/repositories/post_event_response_module/post-event-response-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { FormFieldModule } from '@api/config/modules/form-field.module';

@Module({
  imports: [PostEventResponseDbModule, GuardsModule, FormFieldModule],
  controllers: [PostEventResponseController],
  providers: [PostEventResponseService],
  exports: [PostEventResponseService],
})
export class PostEventResponseModule {}
