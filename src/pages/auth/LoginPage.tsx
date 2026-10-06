import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonNote,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function LoginPage() {
  const { signInWithPassword, configured } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [present] = useIonToast()

  const handleSubmit = async () => {
    if (!configured) {
      await present({
        message: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env',
        duration: 3000,
        color: 'warning',
      })
      return
    }
    if (!email.trim() || password.length < 6) {
      await present({
        message: 'Enter a valid email and password (min 6 chars)',
        duration: 2500,
        color: 'danger',
      })
      return
    }

    setBusy(true)
    try {
      await signInWithPassword(email.trim(), password)
      navigate('/tabs/dashboard', { replace: true })
    } catch (err) {
      await present({
        message: err instanceof Error ? err.message : 'Sign in failed',
        duration: 3000,
        color: 'danger',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>MyExpense</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardSubtitle>Welcome back</IonCardSubtitle>
            <IonCardTitle>Sign in</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {!configured && (
              <IonNote color="warning">
                Supabase env vars are missing. Copy `.env.example` to `.env` and
                restart the dev server.
              </IonNote>
            )}
            <IonItem className="ion-margin-top">
              <IonInput
                type="email"
                label="Email"
                labelPlacement="stacked"
                autocomplete="email"
                value={email}
                onIonInput={(event) => setEmail(event.detail.value ?? '')}
              />
            </IonItem>
            <IonItem>
              <IonInput
                type="password"
                label="Password"
                labelPlacement="stacked"
                autocomplete="current-password"
                value={password}
                onIonInput={(event) => setPassword(event.detail.value ?? '')}
              />
            </IonItem>
            <IonButton
              expand="block"
              className="ion-margin-top"
              disabled={busy}
              onClick={() => void handleSubmit()}
            >
              Sign in
            </IonButton>
            <IonText color="medium">
              <p className="muted ion-margin-top">
                No account? <Link to="/register">Create one</Link>
              </p>
            </IonText>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  )
}
