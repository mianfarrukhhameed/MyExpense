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
import { useEffect, useRef, useState } from 'react'
import { EXPENSE_CATEGORIES } from '../../core/config/app.config'
import type { Expense } from '../../core/types/expense'
import { toDateKey } from '../../core/utils/date'
import { getReceiptDisplayUrl } from '../../services/storage/receipts'

export interface ExpenseFormValues {
  amount: number
  category: string
  description: string | null
  date: string
  receiptFile?: File | null
  clearReceipt?: boolean
}

interface ExpenseFormModalProps {
  isOpen: boolean
  expense?: Expense | null
  onDismiss: () => void
  onSubmit: (values: ExpenseFormValues) => Promise<void>
}

export function ExpenseFormModal({
  isOpen,
  expense,
  onDismiss,
  onSubmit,
}: ExpenseFormModalProps) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(toDateKey())
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [clearReceipt, setClearReceipt] = useState(false)
  const [saving, setSaving] = useState(false)
  const [present] = useIonToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    setAmount(expense ? String(expense.amount) : '')
    setCategory(expense?.category ?? EXPENSE_CATEGORIES[0])
    setDescription(expense?.description ?? '')
    setDate(expense?.date ?? toDateKey())
    setReceiptFile(null)
    setClearReceipt(false)
    setSaving(false)

    let cancelled = false
    void (async () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      if (!expense) {
        setPreviewUrl(null)
        return
      }
      const url = await getReceiptDisplayUrl(
        expense.receipt_url,
        expense.local_receipt_blob_key,
      )
      if (cancelled) {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
        return
      }
      if (url?.startsWith('blob:')) objectUrlRef.current = url
      setPreviewUrl(url)
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, expense])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  const handleFileChange = (file: File | null) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setReceiptFile(file)
    setClearReceipt(false)
    if (file) {
      const url = URL.createObjectURL(file)
      objectUrlRef.current = url
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }
  }

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
    if (!category) {
      await present({
        message: 'Choose a category',
        duration: 2000,
        color: 'danger',
      })
      return
    }
    if (!date) {
      await present({
        message: 'Choose a date',
        duration: 2000,
        color: 'danger',
      })
      return
    }

    setSaving(true)
    try {
      await onSubmit({
        amount: parsed,
        category,
        description: description.trim() || null,
        date: date.slice(0, 10),
        receiptFile,
        clearReceipt,
      })
      onDismiss()
    } catch (err) {
      await present({
        message: err instanceof Error ? err.message : 'Could not save expense',
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
          <IonTitle>{expense ? 'Edit expense' : 'New expense'}</IonTitle>
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
        </IonList>

        <IonItem lines="none" className="ion-margin-top">
          <IonLabel>
            <p>Date</p>
          </IonLabel>
        </IonItem>
        <IonDatetime
          presentation="date"
          value={date}
          onIonChange={(event) => {
            const value = event.detail.value
            if (typeof value === 'string') setDate(value.slice(0, 10))
          }}
        />

        <div className="receipt-picker ion-margin-top">
          <IonLabel>
            <p>Receipt (optional)</p>
          </IonLabel>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="receipt-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              handleFileChange(file)
            }}
          />
          <div className="receipt-actions">
            <IonButton
              size="small"
              fill="outline"
              onClick={() => fileRef.current?.click()}
            >
              {previewUrl ? 'Replace photo' : 'Attach photo'}
            </IonButton>
            {previewUrl && (
              <IonButton
                size="small"
                fill="clear"
                color="danger"
                onClick={() => {
                  handleFileChange(null)
                  setClearReceipt(true)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                Remove
              </IonButton>
            )}
          </div>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="receipt-preview"
            />
          )}
        </div>
      </IonContent>
    </IonModal>
  )
}
