export function naN2zero(n: number) {
  return Number.isNaN(n) ? 0 : n;
}
