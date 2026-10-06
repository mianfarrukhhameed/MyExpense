import type { ExpenseCategory } from '../types/expense'

export const APP_NAME = 'MyExpense'
export const DB_NAME = 'myexpense'
export const DB_VERSION = 1

export const DEFAULT_CURRENCY = 'USD'
export const DEFAULT_MONTHLY_BUDGET = 0

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Travel',
  'Rent',
  'Utilities',
  'Entertainment',
  'Other',
]
