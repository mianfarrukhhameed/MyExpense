import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonNote,
  IonText,
} from '@ionic/react'
import { PageScaffold } from '../components/common/PageScaffold'
import { formatMoney } from '../core/utils/money'
import { useExpenses } from '../hooks/useExpenses'
import { useProfile } from '../hooks/useProfile'

export default function DashboardPage() {
  const { count, loading: expensesLoading } = useExpenses()
  const { profile, loading: profileLoading } = useProfile()

  const loading = expensesLoading || profileLoading
  const currency = profile?.currency ?? 'USD'
  const budget = profile?.monthly_budget ?? 0

  return (
    <PageScaffold title="Dashboard">
      <div className="page-section">
        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardSubtitle>Current month</IonCardSubtitle>
            <IonCardTitle>Budget overview</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {loading ? (
              <IonNote>Loading local data…</IonNote>
            ) : (
              <>
                <IonText color="medium">
                  <p className="muted">Planned budget</p>
                </IonText>
                <div className="stat-value">{formatMoney(budget, currency)}</div>
                <IonText color="medium">
                  <p className="muted">Local expenses stored</p>
                </IonText>
                <div className="stat-value">{count}</div>
                <IonNote>
                  Charts, burn rate, and remaining budget arrive in Phase 4.
                </IonNote>
              </>
            )}
          </IonCardContent>
        </IonCard>
      </div>
    </PageScaffold>
  )
}
