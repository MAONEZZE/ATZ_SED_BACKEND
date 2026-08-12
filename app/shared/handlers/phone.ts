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
