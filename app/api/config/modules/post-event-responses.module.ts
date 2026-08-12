import { Module } from '@nestjs/common';
import { PostEventResponsesController } from '@api/controllers/post_event_response_module/post-event-responses.controller';
import { PostEventResponsesService } from '@application/post_event_response_module/post-event-responses.service';
import { PostEventResponsesDbModule } from '@infra/repositories/post_event_response_module/post-event-responses-db.module';
import { GuardsModule } from '@api/config/modules/guards.module';
import { FormFieldsModule } from '@api/config/modules/form-fields.module';

@Module({
  imports: [PostEventResponsesDbModule, GuardsModule, FormFieldsModule],
  controllers: [PostEventResponsesController],
  providers: [PostEventResponsesService],
  exports: [PostEventResponsesService],
})
export class PostEventResponsesModule {}
