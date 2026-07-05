import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OwnershipGuard } from './ownership.guard';
import { AuthModule } from '@infra/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [JwtAuthGuard, OwnershipGuard],
  exports: [JwtAuthGuard, OwnershipGuard, AuthModule],
})
export class GuardsModule {}
