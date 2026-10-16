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

/** Human label for YYYY-MM (e.g. Oct 2026). */
export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  if (!y || !m) return monthKey
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })
}

/** Shift a YYYY-MM key by `delta` months. */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  if (!y || !m) return monthKey
  const d = new Date(y, m - 1 + delta, 1)
  return toMonthKey(d)
}

/** Next occurrence for a monthly plan from a due date + preferred day-of-month. */
export function nextMonthlyDueDate(
  fromDateKey: string,
  dayOfMonth: number,
): string {
  const [y, m] = fromDateKey.slice(0, 7).split('-').map(Number)
  if (!y || !m) return fromDateKey
  const next = new Date(y, m, 1) // first of following month
  const dim = daysInMonth(next.getFullYear(), next.getMonth())
  const day = Math.min(Math.max(1, dayOfMonth), dim)
  next.setDate(day)
  return toDateKey(next)
}

/** List of recent month keys ending at current (newest first), plus optional older. */
export function recentMonthKeys(count = 12, now = new Date()): string[] {
  const keys: string[] = []
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(toMonthKey(d))
  }
  return keys
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
