import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react'
import { useEffect, useState } from 'react'
import type { Loan, LoanDirection } from '../../core/types/loan'
import { toDateKey } from '../../core/utils/date'

export interface LoanFormValues {
  person: string
  amount: number
  remaining?: number
  direction: LoanDirection
  loan_date: string
  due_date: string
  description: string | null
}

interface LoanFormModalProps {
  isOpen: boolean
  loan?: Loan | null
  onDismiss: () => void
  onSubmit: (values: LoanFormValues) => Promise<void>
}

export function LoanFormModal({
  isOpen,
  loan,
  onDismiss,
  onSubmit,
}: LoanFormModalProps) {
  const [person, setPerson] = useState('')
  const [amount, setAmount] = useState('')
  const [remaining, setRemaining] = useState('')
  const [direction, setDirection] = useState<LoanDirection>('borrowed')
  const [loanDate, setLoanDate] = useState(toDateKey())
  const [dueDate, setDueDate] = useState(toDateKey())
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [present] = useIonToast()

  useEffect(() => {
    if (!isOpen) return
    setPerson(loan?.person ?? '')
    setAmount(loan ? String(loan.amount) : '')
    setRemaining(loan ? String(loan.remaining) : '')
    setDirection(loan?.direction ?? 'borrowed')
    setLoanDate(loan?.loan_date ?? toDateKey())
    setDueDate(loan?.due_date ?? toDateKey())
    setDescription(loan?.description ?? '')
    setSaving(false)
  }, [isOpen, loan])

  const handleSave = async () => {
    const parsed = Number.parseFloat(amount)
    if (!person.trim()) {
      await present({
        message: 'Enter a person name',
        duration: 2000,
        color: 'danger',
      })
      return
    }
    if (Number.isNaN(parsed) || parsed <= 0) {
      await present({
        message: 'Enter an amount greater than 0',
        duration: 2000,
        color: 'danger',
      })
      return
    }

    let remainingValue = parsed
    if (loan) {
      const rem = Number.parseFloat(remaining)
      if (Number.isNaN(rem) || rem < 0) {
        await present({
          message: 'Enter a valid remaining amount',
          duration: 2000,
          color: 'danger',
        })
        return
      }
      remainingValue = rem
    }

    setSaving(true)
    try {
      await onSubmit({
        person: person.trim(),
        amount: parsed,
        remaining: remainingValue,
        direction,
        loan_date: loanDate.slice(0, 10),
        due_date: dueDate.slice(0, 10),
        description: description.trim() || null,
      })
      onDismiss()
    } catch (err) {
      await present({
        message: err instanceof Error ? err.message : 'Could not save loan',
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
          <IonTitle>{loan ? 'Edit loan' : 'New loan'}</IonTitle>
          <IonButtons slot="end">
            <IonButton strong disabled={saving} onClick={() => void handleSave()}>
              Save
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonList inset>
          <IonItem>
            <IonSelect
              label="Type"
              labelPlacement="stacked"
              interface="popover"
              value={direction}
              onIonChange={(event) =>
                setDirection(event.detail.value as LoanDirection)
              }
            >
              <IonSelectOption value="borrowed">
                Borrowed (I owe)
              </IonSelectOption>
              <IonSelectOption value="lent">Lent (owed to me)</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonInput
              label="Person"
              labelPlacement="stacked"
              placeholder="Name"
              value={person}
              onIonInput={(event) => setPerson(event.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonInput
              type="number"
              inputMode="decimal"
              label="Amount"
              labelPlacement="stacked"
              placeholder="0.00"
              value={amount}
              onIonInput={(event) => setAmount(event.detail.value ?? '')}
            />
          </IonItem>
          {loan && (
            <IonItem>
              <IonInput
                type="number"
                inputMode="decimal"
                label="Remaining"
                labelPlacement="stacked"
                value={remaining}
                onIonInput={(event) => setRemaining(event.detail.value ?? '')}
              />
            </IonItem>
          )}
          <IonItem>
            <IonInput
              label="Note"
              labelPlacement="stacked"
              placeholder="Optional"
              value={description}
              onIonInput={(event) => setDescription(event.detail.value ?? '')}
            />
          </IonItem>
        </IonList>

        <IonItem lines="none" className="ion-margin-top">
          <IonLabel>
            <p>Loan date</p>
          </IonLabel>
        </IonItem>
        <IonDatetime
          presentation="date"
          value={loanDate}
          onIonChange={(event) => {
            const value = event.detail.value
            if (typeof value === 'string') setLoanDate(value.slice(0, 10))
          }}
        />

        <IonItem lines="none" className="ion-margin-top">
          <IonLabel>
            <p>Due date</p>
          </IonLabel>
        </IonItem>
        <IonDatetime
          presentation="date"
          value={dueDate}
          onIonChange={(event) => {
            const value = event.detail.value
            if (typeof value === 'string') setDueDate(value.slice(0, 10))
          }}
        />
      </IonContent>
    </IonModal>
  )
}
