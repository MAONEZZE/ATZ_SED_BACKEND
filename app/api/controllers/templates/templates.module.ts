import { Module } from '@nestjs/common';
import { TemplatesController } from './templates_routes/templates.controller';
import { GuardsModule } from '@api/config/guards/guards.module';

@Module({
  imports: [GuardsModule],
  controllers: [TemplatesController],
})
export class TemplatesModule {}
