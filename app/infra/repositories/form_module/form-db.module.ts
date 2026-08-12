import { Global, Module } from '@nestjs/common';
import { FORM_REPOSITORY_PORT } from '@domain/form_module/i-repository-form';
import { PrismaFormRepository } from './prisma-form.repository';

@Global()
@Module({
  providers: [{ provide: FORM_REPOSITORY_PORT, useClass: PrismaFormRepository }],
  exports: [FORM_REPOSITORY_PORT],
})
export class FormDbModule {}
