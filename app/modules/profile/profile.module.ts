import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { WhatsappController } from './whatsapp.controller';
import { ProfileService } from '@modules/profile/profile.service';
import { GuardsModule } from '@shared/guards/guards.module';
import { StorageModule } from '@infra/storage/storage.module';
import { IntegrationsModule } from '@infra/integrations/integrations.module';
import { ProfileDbModule } from '@modules/profile/profile-db.module';
import { WhatsappInstancesModule } from '@modules/whatsapp-instances/whatsapp-instances.module';

@Module({
  imports: [GuardsModule, StorageModule, IntegrationsModule, ProfileDbModule, WhatsappInstancesModule],
  controllers: [ProfileController, WhatsappController],
  providers: [ProfileService],
})
export class ProfileModule {}
