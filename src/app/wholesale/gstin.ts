/** Client-side GSTIN helpers. The server enforces format and state; the checksum is advisory only. */

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface GstinCheck {
  /** '' when empty or valid; otherwise a blocking format problem. */
  error: string;
  /** Non-blocking: the 15th (check) character does not match the expected value. */
  checksumWarning: string;
  /** First two digits when the format is valid. */
  stateCode: string | null;
}

export function checkGstin(raw: string | null | undefined): GstinCheck {
  const gstin = (raw || '').trim().toUpperCase();
  if (!gstin) return { error: '', checksumWarning: '', stateCode: null };
  if (gstin.length !== 15) return { error: 'GSTIN must be exactly 15 characters.', checksumWarning: '', stateCode: null };
  if (!GSTIN_PATTERN.test(gstin)) {
    return { error: 'GSTIN format looks wrong (expected like 33ABCDE1234F1Z5).', checksumWarning: '', stateCode: null };
  }
  const expected = gstinCheckChar(gstin);
  return {
    error: '',
    checksumWarning: expected !== gstin[14]
      ? `The last character is usually '${expected}' for this GSTIN — please double-check it.` : '',
    stateCode: gstin.substring(0, 2)
  };
}

/** Standard GSTIN check character (mod-36, alternating weights 1 and 2). */
export function gstinCheckChar(gstin: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = CHARS.indexOf(gstin[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}
