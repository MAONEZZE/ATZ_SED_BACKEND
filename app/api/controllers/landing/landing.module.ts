import { Module } from '@nestjs/common';
import { LandingController } from './landing_routes/landing.controller';
import { GuardsModule } from '@api/config/guards/guards.module';

@Module({
  imports: [GuardsModule],
  controllers: [LandingController],
})
export class LandingModule {}
