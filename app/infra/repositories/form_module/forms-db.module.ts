import { Global, Module } from '@nestjs/common';
import { FormsRepository } from './forms.repository';

@Global()
@Module({
  providers: [FormsRepository],
  exports: [FormsRepository],
})
export class FormsDbModule {}
