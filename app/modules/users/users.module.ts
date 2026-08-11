import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { WhatsappController } from './whatsapp.controller';
import { ProfileService } from '@modules/users/profile.service';
import { GuardsModule } from '@shared/guards/guards.module';
import { StorageModule } from '@infra/storage/storage.module';
import { IntegrationsModule } from '@infra/integrations/integrations.module';
import { UsersDbModule } from '@modules/users/users-db.module';
import { WhatsappInstancesModule } from '@modules/whatsapp-instances/whatsapp-instances.module';

@Module({
  imports: [GuardsModule, StorageModule, IntegrationsModule, UsersDbModule, WhatsappInstancesModule],
  controllers: [ProfileController, WhatsappController],
  providers: [ProfileService],
})
export class UsersModule {}
