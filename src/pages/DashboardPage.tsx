import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonNote,
  IonSpinner,
  useIonToast,
} from '@ionic/react'
import { useEffect, useMemo, useState } from 'react'
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
import {
  getCaptureCapabilities,
  type CaptureCapabilities,
} from '../services/ai/capability'
import { AiMethod, presentMethodToast } from '../services/ai/method-labels'
import { writeFinancialReview } from '../services/ai/writer'

export default function DashboardPage() {
  const { expenses, loading: expensesLoading } = useExpenses()
  const { profile, monthBudgets, loading: profileLoading } = useProfile()
  const [monthKey, setMonthKey] = useState(() => toMonthKey())
  const [caps, setCaps] = useState<CaptureCapabilities | null>(null)
  const [review, setReview] = useState<string | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [present] = useIonToast()

  useEffect(() => {
    void getCaptureCapabilities().then(setCaps)
  }, [])

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

  const topCategories = useMemo(() => {
    const map = new Map<string, number>()
    for (const expense of expenses) {
      if (toMonthKey(expense.date) !== monthKey) continue
      map.set(
        expense.category,
        (map.get(expense.category) ?? 0) + Number(expense.amount),
      )
    }
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [expenses, monthKey])

  useEffect(() => {
    setReview(null)
  }, [monthKey])

  const handleGenerateReview = async () => {
    setReviewLoading(true)
    try {
      const text = await writeFinancialReview({
        monthLabel: formatMonthLabel(monthKey),
        currency,
        budget: summary.budget,
        spent: summary.spent,
        remaining: summary.remaining,
        overspent: summary.overspent,
        burnOverPace: burn.overPace,
        projectedMonthEnd: burn.projectedMonthEnd,
        topCategories,
      })
      setReview(text)
      presentMethodToast(present, AiMethod.writer)
    } catch (err) {
      await present({
        message:
          err instanceof Error ? err.message : 'Could not generate review',
        duration: 3000,
        color: 'danger',
      })
    } finally {
      setReviewLoading(false)
    }
  }

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
            <IonCardSubtitle>On-device AI</IonCardSubtitle>
            <IonCardTitle>Financial review</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {caps?.writer ? (
              <>
                <IonButton
                  size="small"
                  disabled={loading || reviewLoading}
                  onClick={() => void handleGenerateReview()}
                >
                  {reviewLoading ? 'Writing…' : 'Generate financial review'}
                </IonButton>
                {reviewLoading && (
                  <div className="ion-margin-top">
                    <IonSpinner name="crescent" />
                  </div>
                )}
                {review && (
                  <p className="financial-review-text ion-margin-top">{review}</p>
                )}
              </>
            ) : (
              <IonNote color="medium">
                Writer API needs desktop Chrome with on-device AI enabled
                (chrome://on-device-internals / Writer origin trial).
              </IonNote>
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
