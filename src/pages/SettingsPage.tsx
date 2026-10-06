import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonText,
  useIonToast,
} from '@ionic/react'
import { useState } from 'react'
import { PageScaffold } from '../components/common/PageScaffold'
import { formatMoney } from '../core/utils/money'
import { platformLabel } from '../core/utils/platform'
import { useExpenses } from '../hooks/useExpenses'
import { useProfile } from '../hooks/useProfile'

export default function SettingsPage() {
  const { profile, pendingSyncCount, loading, setBudget, refresh } = useProfile()
  const { addExpense, count, refresh: refreshExpenses } = useExpenses()
  const [budgetInput, setBudgetInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [present] = useIonToast()

  const currency = profile?.currency ?? 'USD'

  const handleSaveBudget = async () => {
    const amount = Number.parseFloat(budgetInput)
    if (Number.isNaN(amount) || amount < 0) {
      await present({
        message: 'Enter a valid budget amount',
        duration: 2000,
        color: 'danger',
      })
      return
    }

    setBusy(true)
    try {
      await setBudget(amount)
      setBudgetInput('')
      await present({
        message: 'Budget saved locally',
        duration: 2000,
        color: 'success',
      })
    } finally {
      setBusy(false)
    }
  }

  const handleSampleExpense = async () => {
    setBusy(true)
    try {
      await addExpense({
        amount: 12.5,
        category: 'Food',
        description: 'Phase 1 sample expense',
      })
      await present({
        message: 'Sample expense added to IndexedDB',
        duration: 2000,
        color: 'success',
      })
    } finally {
      setBusy(false)
    }
  }

  const handleRefresh = async () => {
    await Promise.all([refresh(), refreshExpenses()])
    await present({ message: 'Local data refreshed', duration: 1500 })
  }

  return (
    <PageScaffold title="Settings">
      <div className="page-section">
        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardSubtitle>Phase 1 smoke test</IonCardSubtitle>
            <IonCardTitle>Local profile</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {loading || !profile ? (
              <IonNote>Loading profile…</IonNote>
            ) : (
              <IonList>
                <IonItem>
                  <IonLabel>
                    <p>Guest profile id</p>
                    <h3>{profile.id}</h3>
                  </IonLabel>
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <p>Platform</p>
                    <h3>{platformLabel()}</h3>
                  </IonLabel>
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <p>Monthly budget</p>
                    <h3>{formatMoney(profile.monthly_budget, currency)}</h3>
                  </IonLabel>
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <p>Currency</p>
                    <h3>{profile.currency}</h3>
                  </IonLabel>
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <p>Expenses in IndexedDB</p>
                    <h3>{count}</h3>
                  </IonLabel>
                </IonItem>
                <IonItem>
                  <IonLabel>
                    <p>Pending sync queue</p>
                    <h3>{pendingSyncCount}</h3>
                  </IonLabel>
                </IonItem>
              </IonList>
            )}
          </IonCardContent>
        </IonCard>

        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardTitle>Set planned budget</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonInput
                type="number"
                inputMode="decimal"
                label="Amount"
                labelPlacement="stacked"
                placeholder="e.g. 500"
                value={budgetInput}
                onIonInput={(event) => setBudgetInput(event.detail.value ?? '')}
              />
            </IonItem>
            <IonButton
              expand="block"
              className="ion-margin-top"
              disabled={busy}
              onClick={() => void handleSaveBudget()}
            >
              Save budget locally
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardTitle>IndexedDB actions</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonButton
              expand="block"
              disabled={busy}
              onClick={() => void handleSampleExpense()}
            >
              Add sample expense
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              className="ion-margin-top"
              disabled={busy}
              onClick={() => void handleRefresh()}
            >
              Refresh local data
            </IonButton>
            <IonText color="medium">
              <p className="muted ion-margin-top">
                Auth, Supabase sync, and cloud backup arrive in Phase 2.
              </p>
            </IonText>
          </IonCardContent>
        </IonCard>
      </div>
    </PageScaffold>
  )
}
