import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonNote,
} from '@ionic/react'
import { useMemo } from 'react'
import { BudgetMeter } from '../components/dashboard/BudgetMeter'
import { BurnRateIndicator } from '../components/dashboard/BurnRateIndicator'
import { MonthCompareChart } from '../components/dashboard/MonthCompareChart'
import { PageScaffold } from '../components/common/PageScaffold'
import {
  monthTotals,
  summarizeBurnRate,
  summarizeMonthBudget,
} from '../core/utils/budget'
import { toMonthKey } from '../core/utils/date'
import { useExpenses } from '../hooks/useExpenses'
import { useProfile } from '../hooks/useProfile'

export default function DashboardPage() {
  const { expenses, loading: expensesLoading } = useExpenses()
  const { profile, loading: profileLoading } = useProfile()

  const loading = expensesLoading || profileLoading
  const currency = profile?.currency ?? 'USD'
  const budget = profile?.monthly_budget ?? 0
  const monthKey = toMonthKey()

  const summary = useMemo(
    () => summarizeMonthBudget(expenses, budget, monthKey),
    [expenses, budget, monthKey],
  )
  const burn = useMemo(
    () => summarizeBurnRate(summary.spent, budget),
    [summary.spent, budget],
  )
  const months = useMemo(() => monthTotals(expenses, 12), [expenses])

  return (
    <PageScaffold title="Dashboard">
      <div className="page-section">
        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardSubtitle>{monthKey}</IonCardSubtitle>
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
                  Edit budget in Settings
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
