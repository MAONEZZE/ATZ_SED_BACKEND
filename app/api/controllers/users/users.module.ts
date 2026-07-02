import { Module } from '@nestjs/common';
import { ProfileController } from './users_routes/profile.controller';
import { WhatsappController } from './users_routes/whatsapp.controller';
import { ProfileService } from '@services/users/profile.service';
import { GuardsModule } from '@api/config/guards/guards.module';
import { StorageModule } from '@database/storage/storage.module';
import { IntegrationsModule } from '@database/integrations/integrations.module';
import { UsersDbModule } from '@database/users/users-db.module';

@Module({
  imports: [GuardsModule, StorageModule, IntegrationsModule, UsersDbModule],
  controllers: [ProfileController, WhatsappController],
  providers: [ProfileService],
})
export class UsersModule {}
