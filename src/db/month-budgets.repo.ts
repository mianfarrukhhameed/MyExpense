import type { MonthBudget } from '../core/types/month-budget'
import { getDb } from './index'
import { STORE_MONTH_BUDGETS } from './schema'

export function monthBudgetId(userId: string, monthKey: string): string {
  return `${userId}:${monthKey}`
}

export async function listMonthBudgets(): Promise<MonthBudget[]> {
  const db = await getDb()
  const all = await db.getAll(STORE_MONTH_BUDGETS)
  return all.sort((a, b) => b.month_key.localeCompare(a.month_key))
}

export async function getMonthBudget(
  monthKey: string,
): Promise<MonthBudget | undefined> {
  const db = await getDb()
  const all = await db.getAll(STORE_MONTH_BUDGETS)
  return all.find((row) => row.month_key === monthKey)
}

export async function getMonthBudgetById(
  id: string,
): Promise<MonthBudget | undefined> {
  const db = await getDb()
  return db.get(STORE_MONTH_BUDGETS, id)
}

export async function upsertMonthBudget(
  budget: MonthBudget,
): Promise<MonthBudget> {
  const db = await getDb()
  await db.put(STORE_MONTH_BUDGETS, budget)
  return budget
}

export async function removeMonthBudget(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_MONTH_BUDGETS, id)
}

export async function clearMonthBudgets(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE_MONTH_BUDGETS)
}

/** Prefer month-specific amount; fall back to default monthly budget. */
export function resolveBudgetForMonth(
  monthBudgets: MonthBudget[],
  monthKey: string,
  defaultBudget: number,
): number {
  const match = monthBudgets.find((row) => row.month_key === monthKey)
  if (match) return Number(match.amount)
  return defaultBudget
}
