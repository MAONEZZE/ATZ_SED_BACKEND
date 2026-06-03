import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { OwnershipGuard } from './ownership.guard';
import { AuthModule } from '@database/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [JwtAuthGuard, RolesGuard, OwnershipGuard],
  exports: [JwtAuthGuard, RolesGuard, OwnershipGuard],
})
export class GuardsModule {}
