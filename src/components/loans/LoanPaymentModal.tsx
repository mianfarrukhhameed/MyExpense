import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react'
import { useEffect, useState } from 'react'
import type { Loan } from '../../core/types/loan'
import { toDateKey } from '../../core/utils/date'
import { formatMoney } from '../../core/utils/money'

interface LoanPaymentModalProps {
  isOpen: boolean
  loan: Loan | null
  currency: string
  onDismiss: () => void
  onSubmit: (amount: number, paidDate: string) => Promise<void>
}

export function LoanPaymentModal({
  isOpen,
  loan,
  currency,
  onDismiss,
  onSubmit,
}: LoanPaymentModalProps) {
  const [amount, setAmount] = useState('')
  const [paidDate, setPaidDate] = useState(toDateKey())
  const [saving, setSaving] = useState(false)
  const [present] = useIonToast()

  useEffect(() => {
    if (!isOpen || !loan) return
    setAmount(String(loan.remaining))
    setPaidDate(toDateKey())
    setSaving(false)
  }, [isOpen, loan])

  const handleSave = async () => {
    if (!loan) return
    const parsed = Number.parseFloat(amount)
    if (Number.isNaN(parsed) || parsed <= 0) {
      await present({
        message: 'Enter a payment greater than 0',
        duration: 2000,
        color: 'danger',
      })
      return
    }
    if (parsed > loan.remaining) {
      await present({
        message: 'Payment exceeds remaining balance',
        duration: 2000,
        color: 'danger',
      })
      return
    }

    setSaving(true)
    try {
      await onSubmit(parsed, paidDate.slice(0, 10))
      onDismiss()
    } catch (err) {
      await present({
        message: err instanceof Error ? err.message : 'Payment failed',
        duration: 2500,
        color: 'danger',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>Cancel</IonButton>
          </IonButtons>
          <IonTitle>Record payment</IonTitle>
          <IonButtons slot="end">
            <IonButton strong disabled={saving} onClick={() => void handleSave()}>
              Save
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loan && (
          <p className="muted">
            {loan.direction === 'borrowed' ? 'Paying' : 'Receiving from'}{' '}
            {loan.person}. Remaining {formatMoney(loan.remaining, currency)}.
          </p>
        )}
        <IonItem>
          <IonInput
            type="number"
            inputMode="decimal"
            label="Payment amount"
            labelPlacement="stacked"
            value={amount}
            onIonInput={(event) => setAmount(event.detail.value ?? '')}
          />
        </IonItem>
        <IonItem lines="none" className="ion-margin-top">
          <IonLabel>
            <p>Paid date</p>
          </IonLabel>
        </IonItem>
        <IonDatetime
          presentation="date"
          value={paidDate}
          onIonChange={(event) => {
            const value = event.detail.value
            if (typeof value === 'string') setPaidDate(value.slice(0, 10))
          }}
        />
      </IonContent>
    </IonModal>
  )
}
