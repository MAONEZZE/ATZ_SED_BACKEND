import { Module } from '@nestjs/common';
import { ProfileController } from '@api/controllers/profile_module/profile.controller';
import { ProfileService } from '@application/profile_module/profile.service';
import { GuardsModule } from '@shared/modules/guards.module';
import { StorageModule } from '@shared/modules/storage.module';
import { AdaptersModule } from '@shared/modules/adapters.module';
import { ProfileDbModule } from '@infra/repositories/profile_module/profile-db.module';

@Module({
  imports: [GuardsModule, StorageModule, AdaptersModule, ProfileDbModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
