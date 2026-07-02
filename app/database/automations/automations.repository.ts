import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaRepositoryBase } from '@database/shared/prisma-repository.base';

const TEMPLATE_SUMMARY = {
  template: { select: { id: true, name: true, channel: true } },
} as const;

@Injectable()
export class AutomationsRepository extends PrismaRepositoryBase {
  async findAllByEventPaginated(
    eventId: string,
    pagination: { skip: number; take: number },
  ): Promise<{ data: object[]; total: number }> {
    const where = { eventId };
    const [data, total] = await Promise.all([
      this.prisma.automationRule.findMany({
        where,
        include: TEMPLATE_SUMMARY,
        orderBy: { createdAt: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.automationRule.count({ where }),
    ]);
    return { data, total };
  }

  findOneWithTemplate(eventId: string, id: string) {
    return this.prisma.automationRule.findFirst({
      where: { id, eventId },
      include: { template: true },
    });
  }

  findByEvent(eventId: string, id: string) {
    return this.prisma.automationRule.findFirst({ where: { id, eventId } });
  }

  templateById(templateId: string) {
    return this.prisma.messageTemplate.findFirst({ where: { id: templateId } });
  }

  create(data: Prisma.AutomationRuleUncheckedCreateInput) {
    return this.prisma.automationRule.create({ data, include: TEMPLATE_SUMMARY });
  }

  update(id: string, data: Prisma.AutomationRuleUncheckedUpdateInput) {
    return this.prisma.automationRule.update({ where: { id }, data, include: TEMPLATE_SUMMARY });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.automationRule.delete({ where: { id } });
  }
}
