import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OwnershipGuard } from '../guards/ownership.guard';
import { AuthModule } from '@api/config/modules/auth.module';
import { EventsDbModule } from '@infra/repositories/event_module/events-db.module';

@Module({
  imports: [AuthModule, EventsDbModule],
  providers: [JwtAuthGuard, OwnershipGuard],
  exports: [JwtAuthGuard, OwnershipGuard, AuthModule],
})
export class GuardsModule {}
