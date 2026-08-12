import { Global, Module } from '@nestjs/common';
import { POST_EVENT_RESPONSE_REPOSITORY_PORT } from '@domain/post_event_response_module/i-repository-post-event-response';
import { PrismaPostEventResponseRepository } from './prisma-post-event-response.repository';

@Global()
@Module({
  providers: [
    { provide: POST_EVENT_RESPONSE_REPOSITORY_PORT, useClass: PrismaPostEventResponseRepository },
  ],
  exports: [POST_EVENT_RESPONSE_REPOSITORY_PORT],
})
export class PostEventResponsesDbModule {}
