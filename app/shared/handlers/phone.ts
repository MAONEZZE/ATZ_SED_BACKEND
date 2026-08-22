const BR_COUNTRY_CODE = '55';

function onlyDigits(raw: string): string {
  return (raw ?? '').replace(/\D/g, '');
}

/**
 * Parte nacional (DDD + número) quando dá para afirmar que o telefone é
 * brasileiro; `null` quando não é, ou quando não há como afirmar.
 *
 * É o único lugar que decide "isso é BR": `normalizePhone` e `phoneMatchKey`
 * derivam daqui, então a regra não vive em dois lugares.
 *
 * Aceita: 10 dígitos (fixo ou celular antigo sem o nono), 11 dígitos com `9` na
 * frente do número (celular atual) e as versões com `55` na frente.
 * Recusa 11 dígitos sem esse `9` — celular brasileiro **sempre** tem, então
 * `17862981966` (EUA, código 1) não é lido como DDD 17.
 */
function brNationalNumber(raw: string): string | null {
  const digits = onlyDigits(raw);

  const national =
    digits.startsWith(BR_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)
      ? digits.slice(BR_COUNTRY_CODE.length)
      : digits;

  if (national.length !== 10 && national.length !== 11) return null;
  if (national.length === 11 && national[2] !== '9') return null;

  const ddd = Number(national.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;

  return national;
}

/**
 * Normalizes a raw phone string to Brazilian digits-only form (`55` + DDD +
 * number), stripping formatting and prepending the country code when missing.
 * Returns `null` when the number isn't recognisable as Brazilian — inclusive
 * número estrangeiro, que antes ganhava um `55` na frente e virava outro número.
 */
export function normalizePhone(raw: string): string | null {
  const national = brNationalNumber(raw);
  return national && BR_COUNTRY_CODE + national;
}

/**
 * Chave de comparação entre telefones gravados em formatos diferentes. Serve
 * para qualquer país; o que muda é a tolerância:
 *
 * - **BR** → `55` + DDD + últimos 8 dígitos. Ignora o `55` e o nono dígito, as
 *   duas divergências do banco, então `(11) 99999-8888`, `5511999998888` e
 *   `1199998888` casam entre si — e um DDD diferente com o mesmo final não casa.
 * - **qualquer outro país** → os dígitos como vieram, sem tolerância nenhuma:
 *   fora do Brasil não se sabe o tamanho do código do país nem se existe
 *   equivalente do nono dígito, e chutar isso juntaria pessoas diferentes.
 *
 * Os dois formatos terminam nos 8 dígitos finais do número (ver
 * `phoneMatchSuffix`), que é o pré-filtro do banco.
 *
 * Limite conhecido: 10 dígitos sem código de país e com DDD plausível é
 * ambíguo por natureza (`7862981966` pode ser DDD 78 ou um americano sem o `1`)
 * e é lido como BR. Sem um país informado não há como decidir.
 *
 * `null` quando não há dígito suficiente para identificar alguém.
 */
export function phoneMatchKey(raw: string): string | null {
  const national = brNationalNumber(raw);
  if (national) return BR_COUNTRY_CODE + national.slice(0, 2) + national.slice(-8);

  const digits = onlyDigits(raw);
  return digits.length >= 10 ? digits : null;
}

/** Os 8 dígitos finais da chave — o filtro que vai para a query do banco. */
export function phoneMatchSuffix(key: string): string {
  return key.slice(-8);
}
