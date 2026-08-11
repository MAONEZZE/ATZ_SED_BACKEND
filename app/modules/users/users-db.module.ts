import { Global, Module } from '@nestjs/common';
import { ProfileRepository } from './profile.repository';

@Global()
@Module({
  providers: [ProfileRepository],
  exports: [ProfileRepository],
})
export class UsersDbModule {}
