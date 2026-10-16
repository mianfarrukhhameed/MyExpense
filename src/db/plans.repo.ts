import { toMonthKey } from '../core/utils/date'
import type { PlanExpense } from '../core/types/plan'
import { getDb } from './index'
import { STORE_PLANS } from './schema'

export async function listPlans(): Promise<PlanExpense[]> {
  const db = await getDb()
  const all = await db.getAll(STORE_PLANS)
  return all.sort((a, b) => {
    if (a.due_date === b.due_date) {
      return b.created_at.localeCompare(a.created_at)
    }
    return a.due_date.localeCompare(b.due_date)
  })
}

export async function listUpcomingPlans(): Promise<PlanExpense[]> {
  const all = await listPlans()
  return all.filter((plan) => plan.status === 'upcoming')
}

export async function getPlanById(id: string): Promise<PlanExpense | undefined> {
  const db = await getDb()
  return db.get(STORE_PLANS, id)
}

export async function upsertPlan(plan: PlanExpense): Promise<PlanExpense> {
  const db = await getDb()
  await db.put(STORE_PLANS, plan)
  return plan
}

export async function removePlan(id: string): Promise<void> {
  const db = await getDb()
  await db.delete(STORE_PLANS, id)
}

export async function clearPlans(): Promise<void> {
  const db = await getDb()
  await db.clear(STORE_PLANS)
}

export function filterPlansByMonth(
  plans: PlanExpense[],
  monthKey: string | null,
): PlanExpense[] {
  if (!monthKey) return plans
  return plans.filter((plan) => toMonthKey(plan.due_date) === monthKey)
}

export function sumPlans(plans: PlanExpense[]): number {
  return plans.reduce((sum, plan) => sum + Number(plan.amount), 0)
}
