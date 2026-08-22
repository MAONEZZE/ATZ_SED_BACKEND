import { Global, Module } from '@nestjs/common';
import { FOLDER_REPOSITORY_PORT } from '@domain/folder_module/i-repository-folder';
import { PrismaFolderRepository } from './prisma-folder.repository';

@Global()
@Module({
  providers: [{ provide: FOLDER_REPOSITORY_PORT, useClass: PrismaFolderRepository }],
  exports: [FOLDER_REPOSITORY_PORT],
})
export class FolderDbModule {}
