import type { Expense } from '../types/expense'
import { daysInMonth, toMonthKey } from './date'

export interface MonthBudgetSummary {
  monthKey: string
  budget: number
  spent: number
  remaining: number
  progress: number
  overspent: boolean
}

export interface BurnRateSummary {
  dayOfMonth: number
  daysInMonth: number
  actualDaily: number
  allowedDaily: number
  projectedMonthEnd: number
  overPace: boolean
}

export interface MonthTotal {
  monthKey: string
  label: string
  total: number
  isMax: boolean
}

export function sumExpensesForMonth(
  expenses: Expense[],
  monthKey: string,
): number {
  return expenses
    .filter((expense) => toMonthKey(expense.date) === monthKey)
    .reduce((sum, expense) => sum + Number(expense.amount), 0)
}

export function summarizeMonthBudget(
  expenses: Expense[],
  budget: number,
  monthKey: string = toMonthKey(),
): MonthBudgetSummary {
  const spent = sumExpensesForMonth(expenses, monthKey)
  const remaining = budget - spent
  const progress =
    budget > 0 ? Math.min(1, Math.max(0, spent / budget)) : spent > 0 ? 1 : 0

  return {
    monthKey,
    budget,
    spent,
    remaining,
    progress,
    overspent: spent > budget && budget > 0,
  }
}

export function summarizeBurnRate(
  spent: number,
  budget: number,
  date = new Date(),
): BurnRateSummary {
  const dayOfMonth = date.getDate()
  const totalDays = daysInMonth(date.getFullYear(), date.getMonth())
  const actualDaily = dayOfMonth > 0 ? spent / dayOfMonth : 0
  const allowedDaily = totalDays > 0 && budget > 0 ? budget / totalDays : 0
  const projectedMonthEnd = actualDaily * totalDays
  const overPace = budget > 0 && projectedMonthEnd > budget

  return {
    dayOfMonth,
    daysInMonth: totalDays,
    actualDaily,
    allowedDaily,
    projectedMonthEnd,
    overPace,
  }
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  if (!y || !m) return monthKey
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: 'short',
    year: '2-digit',
  })
}

/** Last `months` calendar months (including current), oldest → newest. */
export function monthTotals(
  expenses: Expense[],
  months = 12,
  now = new Date(),
): MonthTotal[] {
  const keys: string[] = []
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(toMonthKey(d))
  }

  const totals = keys.map((monthKey) => ({
    monthKey,
    label: monthLabel(monthKey),
    total: sumExpensesForMonth(expenses, monthKey),
    isMax: false,
  }))

  const max = Math.max(0, ...totals.map((row) => row.total))
  if (max > 0) {
    for (const row of totals) {
      row.isMax = row.total === max
    }
  }

  return totals
}
