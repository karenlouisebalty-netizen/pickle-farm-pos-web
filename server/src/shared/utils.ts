/** Format a number as Philippine Peso string: P1,234.00 */
export function formatPeso(amount: number): string {
  return 'P' + Number(amount).toFixed(2)
}

/** Generate a sequential receipt number: PF-000001 */
export function generateReceiptNumber(seq: number): string {
  return 'PF-' + String(seq).padStart(6, '0')
}

/** Today as YYYY-MM-DD string */
export function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Now as ISO string */
export function nowISO(): string {
  return new Date().toISOString()
}

/** Clamp a number between min and max */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** Calculate discount amount from subtotal */
export function calcDiscount(subtotal: number, type: 'pct' | 'fixed', value: number): number {
  if (value <= 0) return 0
  if (type === 'pct') return Math.round(subtotal * value) / 100
  return Math.min(value, subtotal)
}
