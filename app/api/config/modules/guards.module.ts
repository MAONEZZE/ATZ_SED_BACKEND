import { Module } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { OwnershipGuard } from '../guards/ownership.guard';
import { AuthModule } from '@api/adapters/modules/auth.module';
import { EventsDbModule } from '@modules/events/events-db.module';

@Module({
  imports: [AuthModule, EventsDbModule],
  providers: [JwtAuthGuard, OwnershipGuard],
  exports: [JwtAuthGuard, OwnershipGuard, AuthModule],
})
export class GuardsModule {}
