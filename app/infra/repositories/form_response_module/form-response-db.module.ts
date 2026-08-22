import { Global, Module } from '@nestjs/common';
import { FORM_RESPONSE_REPOSITORY_PORT } from '@domain/form_response_module/i-repository-form-response';
import { PrismaFormResponseRepository } from './prisma-form-response.repository';

@Global()
@Module({
  providers: [
    { provide: FORM_RESPONSE_REPOSITORY_PORT, useClass: PrismaFormResponseRepository },
  ],
  exports: [FORM_RESPONSE_REPOSITORY_PORT],
})
export class FormResponseDbModule {}
