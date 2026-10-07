/** Returns YYYY-MM-DD for a Date (local calendar day). */
export function toDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Returns YYYY-MM for a date key or Date. */
export function toMonthKey(input: string | Date = new Date()): string {
  if (typeof input === 'string') {
    return input.slice(0, 7)
  }
  const y = input.getFullYear()
  const m = String(input.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

export function daysRemainingInMonth(date = new Date()): number {
  const total = daysInMonth(date.getFullYear(), date.getMonth())
  return Math.max(0, total - date.getDate() + 1)
}

/** Human label for a YYYY-MM-DD key (Today / Yesterday / locale date). */
export function formatDayLabel(dateKey: string): string {
  const today = toDateKey()
  if (dateKey === today) return 'Today'

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateKey === toDateKey(yesterday)) return 'Yesterday'

  const [y, m, d] = dateKey.split('-').map(Number)
  if (!y || !m || !d) return dateKey
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
