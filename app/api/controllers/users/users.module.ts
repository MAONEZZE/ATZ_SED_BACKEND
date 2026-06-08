import { Module } from '@nestjs/common';
import { ProfileController } from './users_routes/profile.controller';
import { GuardsModule } from '@api/config/guards/guards.module';
import { StorageModule } from '@database/storage/storage.module';

@Module({
  imports: [GuardsModule, StorageModule],
  controllers: [ProfileController],
})
export class UsersModule {}
