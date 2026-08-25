import { Test } from '@nestjs/testing';
import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaAutomationRepository } from '@infra/repositories/automation_module/prisma-automation.repository';

async function makeRepo(automationRule: Record<string, jest.Mock>) {
  const prismaMock = { automationRule } as unknown as PrismaService;
  const moduleRef = await Test.createTestingModule({
    providers: [PrismaAutomationRepository, { provide: PrismaService, useValue: prismaMock }],
  }).compile();
  return { repo: moduleRef.get(PrismaAutomationRepository) };
}

// Único teste que trava a exceção do `ended`: os outros gatilhos disparam em
// evento `ended` DE PROPÓSITO (automation-engine.service.ts), mas
// `on_date_form_field` não — o evento novo/encerrado não deveria seguir
// mandando cobrança mensal. Sem este teste, alguém "simplifica" o `where` pra
// bater com o padrão dos outros repos e o bug volta calado.
describe('PrismaAutomationRepository.findActiveFormFieldDateRules', () => {
  it('filtra por trigger on_date_form_field, active e event.status published', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { repo } = await makeRepo({ findMany });
    const eventDateCutoff = new Date('2026-07-22T00:00:00Z');

    await repo.findActiveFormFieldDateRules({ take: 200, eventDateCutoff });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          trigger: 'on_date_form_field',
          active: true,
          event: {
            status: 'published',
            OR: [{ eventDate: null }, { eventDate: { gte: eventDateCutoff } }],
          },
        },
        take: 200,
      }),
    );
  });

  it('mapeia a junção de formulários de volta como formIds', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'rule-1',
        eventId: 'evt-1',
        sendTime: '09:00',
        timezone: 'UTC',
        forms: [{ formId: 'form-1' }, { formId: 'form-2' }],
      },
    ]);
    const { repo } = await makeRepo({ findMany });

    const rules = await repo.findActiveFormFieldDateRules({
      take: 200,
      eventDateCutoff: new Date('2026-07-22T00:00:00Z'),
    });

    expect(rules).toEqual([
      {
        id: 'rule-1',
        eventId: 'evt-1',
        sendTime: '09:00',
        timezone: 'UTC',
        formIds: ['form-1', 'form-2'],
      },
    ]);
  });
});
