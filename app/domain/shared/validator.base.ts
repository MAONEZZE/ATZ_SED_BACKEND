/**
 * Base dos validadores de domínio, equivalente ao `Validador<X>` do projeto C#
 * que esta arquitetura segue.
 *
 * Divisão de trabalho:
 *   - class-validator nos DTOs (camada api) valida **formato** de entrada:
 *     campo obrigatório, é e-mail, é número.
 *   - o validador de domínio valida **invariante de negócio**: regras que
 *     continuam valendo independente de por onde o dado entrou.
 *
 * Validador é puro: não consulta banco. Regra que precisa do banco (capacidade
 * do evento, gatilho duplicado, dono do recurso) fica no service, que tem a
 * porta do repositório — no C# a separação é a mesma.
 *
 * Devolve a lista de erros em vez de lançar: quem chama decide se vira
 * BadRequest, se acumula ou se apenas registra.
 */
export abstract class ValidatorBase<T> {
  abstract validate(input: T): string[];

  isValid(input: T): boolean {
    return this.validate(input).length === 0;
  }
}
