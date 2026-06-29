const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function isValidAddress(s: string): boolean {
  if (typeof s !== "string") return false;
  if (s.length < 40 || s.length > 120) return false;
  return BASE58.test(s);
}
