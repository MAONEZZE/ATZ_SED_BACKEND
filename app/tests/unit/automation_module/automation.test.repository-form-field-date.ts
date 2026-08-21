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

    await repo.findActiveFormFieldDateRules({ take: 200 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          trigger: 'on_date_form_field',
          active: true,
          event: { status: 'published' },
        },
        take: 200,
      }),
    );
  });
});
