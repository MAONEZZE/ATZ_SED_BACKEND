import { Injectable } from '@nestjs/common';
import { PrismaRepositoryBase } from '@infra/repositories/shared/prisma-repository.base';
import { WhatsappInstanceEntity } from '@domain/whatsapp_instance_module/whatsapp-instance.entity';
import { WhatsappInstanceRepositoryPort } from '@domain/whatsapp_instance_module/i-repository-whatsapp-instance';

const INSTANCE_SELECT = { id: true, nickname: true, token: true } as const;

@Injectable()
export class PrismaWhatsappInstanceRepository
  extends PrismaRepositoryBase
  implements WhatsappInstanceRepositoryPort
{
  private toEntity(row: {
    id: string;
    nickname: string;
    token: string | null;
  }): WhatsappInstanceEntity {
    return new WhatsappInstanceEntity(row.id, row.nickname, row.token);
  }

  async list(): Promise<WhatsappInstanceEntity[]> {
    const rows = await this.prisma.whatsappInstance.findMany({
      select: INSTANCE_SELECT,
      orderBy: { nickname: 'asc' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async findById(id: string): Promise<WhatsappInstanceEntity | null> {
    const row = await this.prisma.whatsappInstance.findUnique({
      where: { id },
      select: INSTANCE_SELECT,
    });
    return row ? this.toEntity(row) : null;
  }

  async listForProfile(profileId: string): Promise<WhatsappInstanceEntity[]> {
    const rows = await this.prisma.whatsappInstance.findMany({
      where: { allowedProfiles: { some: { profileId } } },
      select: INSTANCE_SELECT,
      orderBy: { nickname: 'asc' },
    });
    return rows.map((row) => this.toEntity(row));
  }

  async isAllowedForProfile(instanceId: string, profileId: string): Promise<boolean> {
    const count = await this.prisma.profileWhatsappInstance.count({
      where: { instanceId, profileId },
    });
    return count > 0;
  }
}
