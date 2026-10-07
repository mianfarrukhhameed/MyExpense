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
  IonSelect,
  IonSelectOption,
  IonText,
  IonToggle,
  useIonToast,
} from '@ionic/react'
import { useState } from 'react'
import { PageScaffold } from '../components/common/PageScaffold'
import { getLastSyncAt } from '../db/sync-meta'
import { formatMoney } from '../core/utils/money'
import { platformLabel } from '../core/utils/platform'
import { useAuth } from '../hooks/useAuth'
import { useExpenses } from '../hooks/useExpenses'
import { useProfile } from '../hooks/useProfile'
import {
  disableDailyReminder,
  enableDailyReminder,
  getDailyReminderPref,
  isFcmConfigured,
} from '../push/fcm'
import { syncNow } from '../services/sync/sync-engine'

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function SettingsPage() {
  const { user, logOut, configured } = useAuth()
  const { profile, pendingSyncCount, loading, setBudget, setCurrency, refresh } =
    useProfile()
  const { addExpense, count, refresh: refreshExpenses } = useExpenses()
  const [budgetInput, setBudgetInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [reminderOn, setReminderOn] = useState(() => getDailyReminderPref())
  const [lastSync, setLastSync] = useState<string | null>(() => getLastSyncAt())
  const [present] = useIonToast()

  const currency = profile?.currency ?? 'USD'
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true
  const fcmReady = isFcmConfigured()

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
        description: 'Sample expense',
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

  const handleSyncNow = async () => {
    if (!configured) {
      await present({
        message: 'Configure Supabase in .env first',
        duration: 2500,
        color: 'warning',
      })
      return
    }
    setBusy(true)
    try {
      const result = await syncNow()
      setLastSync(getLastSyncAt())
      await refresh()
      await refreshExpenses()
      const errSuffix =
        result.errors.length > 0 ? ` · ${result.errors[0]}` : ''
      await present({
        message: `Synced: pushed ${result.flushed}, pulled ${result.pulled}${errSuffix}`,
        duration: 3000,
        color: result.errors.length ? 'warning' : 'success',
      })
    } catch (err) {
      await present({
        message: err instanceof Error ? err.message : 'Sync failed',
        duration: 3000,
        color: 'danger',
      })
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    setBusy(true)
    try {
      await logOut()
    } finally {
      setBusy(false)
    }
  }

  const handleReminderToggle = async (enabled: boolean) => {
    setBusy(true)
    try {
      if (enabled) {
        await enableDailyReminder()
        setReminderOn(true)
        await present({
          message: 'Daily reminder enabled',
          duration: 2000,
          color: 'success',
        })
      } else {
        await disableDailyReminder()
        setReminderOn(false)
        await present({
          message: 'Daily reminder disabled',
          duration: 2000,
          color: 'medium',
        })
      }
      await refresh()
    } catch (err) {
      setReminderOn(getDailyReminderPref())
      await present({
        message: err instanceof Error ? err.message : 'Reminder update failed',
        duration: 3000,
        color: 'danger',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageScaffold title="Settings">
      <div className="page-section">
        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardSubtitle>Account</IonCardSubtitle>
            <IonCardTitle>Signed in</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              <IonItem>
                <IonLabel>
                  <p>Email</p>
                  <h3>{user?.email ?? '—'}</h3>
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>
                  <p>User id</p>
                  <h3>{user?.id ?? profile?.id ?? '—'}</h3>
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>
                  <p>Platform</p>
                  <h3>{platformLabel()}</h3>
                </IonLabel>
              </IonItem>
            </IonList>
            <IonButton
              expand="block"
              fill="outline"
              color="medium"
              className="ion-margin-top"
              disabled={busy}
              onClick={() => void handleSignOut()}
            >
              Sign out
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardSubtitle>Cloud sync</IonCardSubtitle>
            <IonCardTitle>Supabase status</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              <IonItem>
                <IonLabel>
                  <p>Connection</p>
                  <h3>{online ? 'Online' : 'Offline'}</h3>
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>
                  <p>Pending sync queue</p>
                  <h3>{pendingSyncCount}</h3>
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>
                  <p>Last sync</p>
                  <h3>{formatSyncTime(lastSync)}</h3>
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>
                  <p>Expenses in IndexedDB</p>
                  <h3>{count}</h3>
                </IonLabel>
              </IonItem>
            </IonList>
            <IonButton
              expand="block"
              className="ion-margin-top"
              disabled={busy}
              onClick={() => void handleSyncNow()}
            >
              Sync now
            </IonButton>
            {!configured && (
              <IonNote color="warning" className="ion-margin-top">
                Set VITE_SUPABASE_* in `.env` to enable cloud sync.
              </IonNote>
            )}
          </IonCardContent>
        </IonCard>

        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardTitle>Local profile</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {loading || !profile ? (
              <IonNote>Loading profile…</IonNote>
            ) : (
              <IonList>
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
            <IonItem className="ion-margin-top">
              <IonSelect
                label="Currency"
                labelPlacement="stacked"
                interface="popover"
                value={currency}
                disabled={busy}
                onIonChange={(event) => {
                  const next = String(event.detail.value)
                  void (async () => {
                    setBusy(true)
                    try {
                      await setCurrency(next)
                      await present({
                        message: `Currency set to ${next}`,
                        duration: 1500,
                        color: 'success',
                      })
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                {['USD', 'EUR', 'GBP', 'PKR', 'INR', 'AED'].map((code) => (
                  <IonSelectOption key={code} value={code}>
                    {code}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </IonCardContent>
        </IonCard>

        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardSubtitle>Notifications</IonCardSubtitle>
            <IonCardTitle>Daily expense reminder</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem lines="none">
              <IonToggle
                checked={reminderOn}
                disabled={busy || !fcmReady}
                onIonChange={(event) =>
                  void handleReminderToggle(event.detail.checked)
                }
              >
                Remind me to log expenses
              </IonToggle>
            </IonItem>
            {!fcmReady ? (
              <IonNote color="medium">
                Set `VITE_FIREBASE_*` in `.env` to enable FCM. iOS needs Add to
                Home Screen (16.4+).
              </IonNote>
            ) : (
              <IonNote color="medium">
                Token is stored on your profile and can be targeted by the
                Cloudflare Worker stub in `workers/daily-reminder/`.
              </IonNote>
            )}
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
            <IonText color="medium">
              <p className="muted ion-margin-top">
                Prefer the Expenses tab for logging. Sample write still goes to
                IndexedDB first; Sync now / online flush pushes to Supabase.
              </p>
            </IonText>
          </IonCardContent>
        </IonCard>
      </div>
    </PageScaffold>
  )
}
