import { Global, Module } from '@nestjs/common';
import { PostEventResponsesRepository } from './post-event-responses.repository';

@Global()
@Module({
  providers: [PostEventResponsesRepository],
  exports: [PostEventResponsesRepository],
})
export class PostEventResponsesDbModule {}
