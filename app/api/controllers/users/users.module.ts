import { Module } from '@nestjs/common';
import { ProfileController } from './users_routes/profile.controller';
import { GuardsModule } from '@api/config/guards/guards.module';

@Module({
  imports: [GuardsModule],
  controllers: [ProfileController],
})
export class UsersModule {}
