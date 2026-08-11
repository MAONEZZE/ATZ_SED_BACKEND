import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OwnershipGuard } from './ownership.guard';
import { AuthModule } from '@infra/auth/auth.module';
import { EventsDbModule } from '@modules/events/events-db.module';

@Module({
  imports: [AuthModule, EventsDbModule],
  providers: [JwtAuthGuard, OwnershipGuard],
  exports: [JwtAuthGuard, OwnershipGuard, AuthModule],
})
export class GuardsModule {}
