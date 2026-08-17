import { Module } from '@nestjs/common';
import { FolderController } from '@api/controllers/folder_module/folder.controller';
import { FolderService } from '@application/folder_module/folder.service';
import { FolderDbModule } from '@infra/repositories/folder_module/folder-db.module';
import { GuardsModule } from '@shared/modules/guards.module';

@Module({
  imports: [FolderDbModule, GuardsModule],
  controllers: [FolderController],
  providers: [FolderService],
  exports: [FolderService],
})
export class FolderModule {}
