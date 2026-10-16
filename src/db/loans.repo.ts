import { toMonthKey } from '../core/utils/date'
import type { Loan } from '../core/types/loan'
import { getDb } from './index'
import { STORE_LOANS } from './schema'

export async function listLoans(): Promise<Loan[]> {
  const db = await getDb()
  const all = await db.getAll(STORE_LOANS)
  return all.sort((a, b) => {
    if (a.due_date === b.due_date) {
      return b.created_at.localeCompare(a.created_at)
    }
    return a.due_date.localeCompare(b.due_date)
  })
}

export async function getLoanById(id: string): Promise<Loan | undefined> {
  const db = await getDb()
  return db.get(STORE_LOANS, id)
}

export async function upsertLoan(loan: Loan): Promise<Loan> {
  const db = await getDb()
  await db.put(STORE_LOANS, loan)
  return loan
}

export async function removeLoan(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_LOANS, id)
}

export async function clearLoans(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE_LOANS)
}

/** Borrowed: filter by due_date. Lent: filter by loan_date. */
export function filterLoansByMonth(
  loans: Loan[],
  monthKey: string | null,
): Loan[] {
  if (!monthKey) return loans
  return loans.filter((loan) => {
    const key =
      loan.direction === 'borrowed'
        ? toMonthKey(loan.due_date)
        : toMonthKey(loan.loan_date)
    return key === monthKey
  })
}

export function sumLoansByDirection(
  loans: Loan[],
  direction: 'borrowed' | 'lent',
): number {
  return loans
    .filter((loan) => loan.direction === direction)
    .reduce((sum, loan) => sum + Number(loan.remaining), 0)
}
