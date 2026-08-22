import { PrismaService } from '@infra/prisma/prisma.service';
import { PrismaAutomationRepository } from '@infra/repositories/automation_module/prisma-automation.repository';

function makeRepo() {
  const findFirst = jest.fn().mockResolvedValue({ folderId: null });
  const findMany = jest.fn().mockResolvedValue([
    { id: 'rule-a', order: 0 },
    { id: 'rule-b', order: 1 },
  ]);
  const update = jest.fn((args: { where: { id: string }; data: { order: number } }) => args);
  const prisma = {
    automationRule: { findFirst, findMany, update },
    $transaction: jest.fn().mockResolvedValue([]),
  } as unknown as PrismaService;
  return { repo: new PrismaAutomationRepository(prisma), findMany, update };
}

describe('PrismaAutomationRepository.move', () => {
  beforeEach(() => jest.clearAllMocks());

  // Escopo é evento + pasta: regra de outro evento não entra na sequência.
  it('sequences only the event and folder of the dragged rule', async () => {
    const { repo, findMany, update } = makeRepo();

    await expect(repo.move('evt-1', 'rule-b', 'rule-a')).resolves.toBe(true);

    const [{ where, orderBy }] = findMany.mock.calls[0] as [Record<string, unknown>];
    expect(where).toEqual({ eventId: 'evt-1', folderId: null });
    // Mesmo desempate da listagem (`findAllByEventPaginated`): createdAt **asc**
    // aqui, ao contrário de eventos e templates. Sequência diferente da que o
    // usuário vê = arrasto cai no lugar errado.
    expect(orderBy).toEqual([{ order: 'asc' }, { createdAt: 'asc' }]);
    expect(update.mock.calls.map(([args]) => args)).toEqual([
      { where: { id: 'rule-b' }, data: { order: 0 } },
      { where: { id: 'rule-a' }, data: { order: 1 } },
    ]);
  });
});
