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
  IonToggle,
  IonToolbar,
  useIonToast,
} from '@ionic/react'
import { useEffect, useState } from 'react'
import { EXPENSE_CATEGORIES } from '../../core/config/app.config'
import type { PlanExpense, PlanRecurrence } from '../../core/types/plan'
import { toDateKey } from '../../core/utils/date'

export interface PlanFormValues {
  amount: number
  category: string
  description: string | null
  due_date: string
  recurrence: PlanRecurrence
  day_of_month: number | null
}

interface PlanFormModalProps {
  isOpen: boolean
  plan?: PlanExpense | null
  onDismiss: () => void
  onSubmit: (values: PlanFormValues) => Promise<void>
}

export function PlanFormModal({
  isOpen,
  plan,
  onDismiss,
  onSubmit,
}: PlanFormModalProps) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(toDateKey())
  const [monthly, setMonthly] = useState(false)
  const [saving, setSaving] = useState(false)
  const [present] = useIonToast()

  useEffect(() => {
    if (!isOpen) return
    setAmount(plan ? String(plan.amount) : '')
    setCategory(plan?.category ?? EXPENSE_CATEGORIES[0])
    setDescription(plan?.description ?? '')
    setDueDate(plan?.due_date ?? toDateKey())
    setMonthly(plan?.recurrence === 'monthly')
    setSaving(false)
  }, [isOpen, plan])

  const handleSave = async () => {
    const parsed = Number.parseFloat(amount)
    if (Number.isNaN(parsed) || parsed <= 0) {
      await present({
        message: 'Enter an amount greater than 0',
        duration: 2000,
        color: 'danger',
      })
      return
    }

    setSaving(true)
    try {
      const date = dueDate.slice(0, 10)
      await onSubmit({
        amount: parsed,
        category,
        description: description.trim() || null,
        due_date: date,
        recurrence: monthly ? 'monthly' : 'none',
        day_of_month: monthly ? Number(date.slice(8, 10)) : null,
      })
      onDismiss()
    } catch (err) {
      await present({
        message: err instanceof Error ? err.message : 'Could not save plan',
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
          <IonTitle>{plan ? 'Edit plan' : 'New plan'}</IonTitle>
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
          <IonItem>
            <IonSelect
              label="Category"
              labelPlacement="stacked"
              interface="popover"
              value={category}
              onIonChange={(event) => setCategory(String(event.detail.value))}
            >
              {EXPENSE_CATEGORIES.map((item) => (
                <IonSelectOption key={item} value={item}>
                  {item}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonInput
              label="Description"
              labelPlacement="stacked"
              placeholder="Optional"
              value={description}
              onIonInput={(event) => setDescription(event.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonToggle
              checked={monthly}
              onIonChange={(event) => setMonthly(event.detail.checked)}
            >
              Repeats every month
            </IonToggle>
          </IonItem>
        </IonList>

        <IonItem lines="none" className="ion-margin-top">
          <IonLabel>
            <p>{monthly ? 'Next due date' : 'Due date'}</p>
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
