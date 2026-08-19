const BR_COUNTRY_CODE = '55';

/**
 * Normalizes a raw phone string to Brazilian digits-only form (`55` + DDD +
 * number), stripping formatting and prepending the country code when
 * missing. Returns `null` when the digit count doesn't match a valid
 * BR DDD+number length (10 or 11 digits, or 12/13 with the `55` prefix).
 */
export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return null;

  const national =
    digits.startsWith(BR_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)
      ? digits.slice(BR_COUNTRY_CODE.length)
      : digits;

  if (national.length !== 10 && national.length !== 11) return null;

  const ddd = Number(national.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;

  return BR_COUNTRY_CODE + national;
}

/**
 * Chave de comparação tolerante entre telefones gravados em formatos
 * diferentes: `DDD + últimos 8 dígitos`.
 *
 * Diferente de `normalizePhone`, ignora o `55` e o nono dígito — as duas fontes
 * de divergência no banco, que tem número com e sem cada um deles. Assim
 * `(11) 99999-8888`, `5511999998888` e `1199998888` casam entre si, mas um DDD
 * diferente com o mesmo final **não** casa.
 *
 * Retorna `null` quando não há dígito suficiente para formar DDD + número.
 */
export function phoneMatchKey(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < 10) return null;

  const national =
    digits.startsWith(BR_COUNTRY_CODE) && digits.length > 11 ? digits.slice(2) : digits;
  if (national.length < 10) return null;

  return national.slice(0, 2) + national.slice(-8);
}

/** Os 8 dígitos finais da chave — o filtro que vai para o `LIKE` do banco. */
export function phoneMatchSuffix(key: string): string {
  return key.slice(-8);
}
