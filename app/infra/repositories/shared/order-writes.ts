/** Só as linhas cujo `order` mudou na sequência nova — evita reescrever o escopo inteiro a cada arrasto. */
export function writesFor(
  rows: Array<{ id: string; order: number }>,
  sequence: string[],
): Array<{ id: string; order: number }> {
  const current = new Map(rows.map((r) => [r.id, r.order]));
  return sequence
    .map((id, order) => ({ id, order }))
    .filter(({ id, order }) => current.get(id) !== order);
}
