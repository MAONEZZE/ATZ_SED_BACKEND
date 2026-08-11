import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { WhatsappController } from './whatsapp.controller';
import { ProfileService } from '@modules/profile/profile.service';
import { GuardsModule } from '@api/config/modules/guards.module';
import { StorageModule } from '@api/adapters/modules/storage.module';
import { AdaptersModule } from '@api/adapters/modules/adapters.module';
import { ProfileDbModule } from '@modules/profile/profile-db.module';
import { WhatsappInstancesModule } from '@modules/whatsapp-instances/whatsapp-instances.module';

@Module({
  imports: [GuardsModule, StorageModule, AdaptersModule, ProfileDbModule, WhatsappInstancesModule],
  controllers: [ProfileController, WhatsappController],
  providers: [ProfileService],
})
export class ProfileModule {}
