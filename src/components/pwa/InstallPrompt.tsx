import {
  IonButton,
  IonContent,
  IonModal,
  IonNote,
  IonText,
} from '@ionic/react'
import { useEffect, useState } from 'react'

const DISMISS_KEY = 'myexpense-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'android' | 'ios' | null>(null)

  useEffect(() => {
    if (isStandalone()) return
    if (localStorage.getItem(DISMISS_KEY) === '1') return

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setMode('android')
      setOpen(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    if (isIos()) {
      setMode('ios')
      setOpen(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setOpen(false)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    dismiss()
  }

  if (!mode) return null

  return (
    <IonModal
      isOpen={open}
      initialBreakpoint={0.35}
      breakpoints={[0, 0.35]}
      onDidDismiss={dismiss}
      className="install-prompt-modal"
    >
      <IonContent className="ion-padding">
        <IonText>
          <h2>Install MyExpense</h2>
        </IonText>
        {mode === 'android' ? (
          <>
            <IonNote>
              Add MyExpense to your home screen for a full-screen offline app.
            </IonNote>
            <IonButton expand="block" className="ion-margin-top" onClick={() => void install()}>
              Install
            </IonButton>
          </>
        ) : (
          <>
            <IonNote>
              On iPhone/iPad: tap <strong>Share</strong>, then{' '}
              <strong>Add to Home Screen</strong>. Web push works best after
              installing as a Home Screen app (iOS 16.4+).
            </IonNote>
            <IonButton
              expand="block"
              fill="outline"
              className="ion-margin-top"
              onClick={dismiss}
            >
              Got it
            </IonButton>
          </>
        )}
        <IonButton expand="block" fill="clear" color="medium" onClick={dismiss}>
          Not now
        </IonButton>
      </IonContent>
    </IonModal>
  )
}
