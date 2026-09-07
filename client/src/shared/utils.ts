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

/** Format a Date or ISO string as locale date */
export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** Format a Date or ISO string as locale time */
export function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
}

/** Format ISO string as "06/17/2026 10:42 AM" */
export function formatDateTime(d: Date | string): string {
  return `${formatDate(d)} ${formatTime(d)}`
}

/** Generate a v4-ish UUID using the browser's crypto API */
export function generateId(): string {
  return crypto.randomUUID()
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
