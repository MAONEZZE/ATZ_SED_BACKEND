import { resequence } from '@domain/shared/resequence';
import { writesFor } from '@infra/repositories/shared/order-writes';

const SCOPE = ['a', 'b', 'c', 'd'];

describe('resequence', () => {
  it('puts the item right before the anchor when dragging down', () => {
    expect(resequence(SCOPE, 'a', 'd')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('puts the item right before the anchor when dragging up', () => {
    expect(resequence(SCOPE, 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
  });

  it('sends the item to the end without an anchor', () => {
    expect(resequence(SCOPE, 'b')).toEqual(['a', 'c', 'd', 'b']);
  });

  it('is a no-op when the item is already before the anchor', () => {
    expect(resequence(SCOPE, 'b', 'c')).toEqual(SCOPE);
  });

  // Sem isso o item cairia no fim da lista por causa do filter que o remove.
  it('is a no-op when dropped on itself', () => {
    expect(resequence(SCOPE, 'b', 'b')).toEqual(SCOPE);
  });

  it('ignores an anchor that is not in the scope', () => {
    expect(resequence(SCOPE, 'a', 'zzz')).toEqual(['b', 'c', 'd', 'a']);
  });
});

describe('writesFor', () => {
  it('returns only the rows whose order changed', () => {
    const rows = [
      { id: 'a', order: 0 },
      { id: 'b', order: 1 },
      { id: 'c', order: 2 },
    ];

    expect(writesFor(rows, ['a', 'c', 'b'])).toEqual([
      { id: 'c', order: 1 },
      { id: 'b', order: 2 },
    ]);
  });

  it('writes nothing when the sequence did not change', () => {
    const rows = [
      { id: 'a', order: 0 },
      { id: 'b', order: 1 },
    ];

    expect(writesFor(rows, ['a', 'b'])).toEqual([]);
  });

  // Legado: quem nunca reordenou tem tudo em 0 (a listagem desempata por
  // createdAt). O primeiro arrasto normaliza o escopo.
  it('normalises a scope where every order is still 0', () => {
    const rows = [
      { id: 'a', order: 0 },
      { id: 'b', order: 0 },
      { id: 'c', order: 0 },
    ];

    expect(writesFor(rows, ['a', 'b', 'c'])).toEqual([
      { id: 'b', order: 1 },
      { id: 'c', order: 2 },
    ]);
  });
});
