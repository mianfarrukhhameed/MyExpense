import { toMonthKey } from '../core/utils/date'
import type { Expense } from '../core/types/expense'
import { getDb } from './index'
import { STORE_EXPENSES } from './schema'

export async function listExpenses(): Promise<Expense[]> {
  const db = await getDb()
  const all = await db.getAll(STORE_EXPENSES)
  return all.sort((a, b) => {
    if (a.date === b.date) {
      return b.created_at.localeCompare(a.created_at)
    }
    return b.date.localeCompare(a.date)
  })
}

export async function listExpensesByMonth(monthKey: string): Promise<Expense[]> {
  const all = await listExpenses()
  return all.filter((expense) => toMonthKey(expense.date) === monthKey)
}

export async function getExpenseById(id: string): Promise<Expense | undefined> {
  const db = await getDb()
  return db.get(STORE_EXPENSES, id)
}

export async function countExpenses(): Promise<number> {
  const db = await getDb()
  return db.count(STORE_EXPENSES)
}

export async function upsertExpense(expense: Expense): Promise<Expense> {
  const db = await getDb()
  await db.put(STORE_EXPENSES, expense)
  return expense
}

export async function removeExpense(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_EXPENSES, id)
}

export async function isExpensesStoreEmpty(): Promise<boolean> {
  return (await countExpenses()) === 0
}
