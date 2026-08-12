/**
 * Base de toda entidade de domínio: identidade e comparação por ela.
 *
 * Duas instâncias carregadas do banco em consultas diferentes representam o
 * mesmo registro, mas são objetos distintos — `===` daria falso. `equals`
 * compara por identidade, que é o que o domínio entende por "mesma entidade".
 *
 * A checagem de `constructor` impede que entidades de tipos diferentes com o
 * mesmo id (um `Form` e um `Registration` compartilhando um uuid, por acaso)
 * se considerem iguais.
 *
 * Não há base equivalente para as portas de repositório: os 13 repositórios do
 * projeto não compartilham nenhum método (`findById` existe em 4, `create` em
 * 9), porque o acesso é escopado por dono ou por evento em vez de por id solto.
 * Cada `i-repository-<entidade>.ts` declara o que de fato tem.
 */
export abstract class EntityBase {
  protected constructor(public readonly id: string) {}

  equals(other?: EntityBase | null): boolean {
    if (!other) return false;
    if (this === other) return true;
    return this.constructor === other.constructor && this.id === other.id;
  }
}
