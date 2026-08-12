import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '@api/config/guards/jwt-auth.guard';
import { OwnershipGuard } from '@api/config/guards/ownership.guard';
import { AuthModule } from '@shared/modules/auth.module';
import { EventDbModule } from '@infra/repositories/event_module/event-db.module';

@Module({
  imports: [AuthModule, EventDbModule],
  providers: [JwtAuthGuard, OwnershipGuard],
  exports: [JwtAuthGuard, OwnershipGuard, AuthModule],
})
export class GuardsModule {}
