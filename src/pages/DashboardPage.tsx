import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonNote,
} from '@ionic/react'
import { useMemo, useState } from 'react'
import { MonthFilterBar } from '../components/common/MonthFilterBar'
import { BudgetMeter } from '../components/dashboard/BudgetMeter'
import { BurnRateIndicator } from '../components/dashboard/BurnRateIndicator'
import { MonthCompareChart } from '../components/dashboard/MonthCompareChart'
import { PageScaffold } from '../components/common/PageScaffold'
import {
  monthTotals,
  summarizeBurnRate,
  summarizeMonthBudget,
} from '../core/utils/budget'
import { formatMonthLabel, toMonthKey } from '../core/utils/date'
import { resolveBudgetForMonth } from '../db/month-budgets.repo'
import { useExpenses } from '../hooks/useExpenses'
import { useProfile } from '../hooks/useProfile'

export default function DashboardPage() {
  const { expenses, loading: expensesLoading } = useExpenses()
  const { profile, monthBudgets, loading: profileLoading } = useProfile()
  const [monthKey, setMonthKey] = useState(() => toMonthKey())

  const loading = expensesLoading || profileLoading
  const currency = profile?.currency ?? 'USD'
  const defaultBudget = profile?.monthly_budget ?? 0
  const budget = useMemo(
    () => resolveBudgetForMonth(monthBudgets, monthKey, defaultBudget),
    [monthBudgets, monthKey, defaultBudget],
  )

  const summary = useMemo(
    () => summarizeMonthBudget(expenses, budget, monthKey),
    [expenses, budget, monthKey],
  )
  const burn = useMemo(
    () =>
      summarizeBurnRate(
        summary.spent,
        budget,
        monthKey === toMonthKey() ? new Date() : new Date(`${monthKey}-01`),
      ),
    [summary.spent, budget, monthKey],
  )
  const months = useMemo(() => monthTotals(expenses, 12), [expenses])

  return (
    <PageScaffold title="Dashboard">
      <div className="page-section">
        <MonthFilterBar
          monthKey={monthKey}
          onChange={(key) => setMonthKey(key ?? toMonthKey())}
        />

        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardSubtitle>{formatMonthLabel(monthKey)}</IonCardSubtitle>
            <IonCardTitle>Budget overview</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {loading ? (
              <IonNote>Loading local data…</IonNote>
            ) : (
              <>
                <BudgetMeter summary={summary} currency={currency} />
                <IonButton
                  routerLink="/tabs/settings"
                  fill="clear"
                  size="small"
                  className="ion-margin-top"
                >
                  Edit month budget in Settings
                </IonButton>
              </>
            )}
          </IonCardContent>
        </IonCard>

        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardSubtitle>Pacing</IonCardSubtitle>
            <IonCardTitle>Burn rate</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {loading ? (
              <IonNote>Loading…</IonNote>
            ) : (
              <BurnRateIndicator
                burn={burn}
                currency={currency}
                budget={budget}
              />
            )}
          </IonCardContent>
        </IonCard>

        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardSubtitle>Last 12 months</IonCardSubtitle>
            <IonCardTitle>Spend comparison</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {loading ? (
              <IonNote>Loading…</IonNote>
            ) : (
              <MonthCompareChart months={months} currency={currency} />
            )}
          </IonCardContent>
        </IonCard>
      </div>
    </PageScaffold>
  )
}
