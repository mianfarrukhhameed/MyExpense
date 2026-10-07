import {
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonText,
  IonThumbnail,
} from '@ionic/react'
import { imageOutline, trashOutline } from 'ionicons/icons'
import { useEffect, useMemo, useState } from 'react'
import type { Expense } from '../../core/types/expense'
import { formatDayLabel } from '../../core/utils/date'
import { formatMoney } from '../../core/utils/money'
import { getReceiptDisplayUrl } from '../../services/storage/receipts'

interface ExpenseListProps {
  expenses: Expense[]
  currency: string
  loading?: boolean
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => Promise<void>
}

interface DayGroup {
  date: string
  label: string
  items: Expense[]
}

function groupByDay(expenses: Expense[]): DayGroup[] {
  const map = new Map<string, Expense[]>()
  for (const expense of expenses) {
    const list = map.get(expense.date) ?? []
    list.push(expense)
    map.set(expense.date, list)
  }
  return Array.from(map.entries()).map(([date, items]) => ({
    date,
    label: formatDayLabel(date),
    items,
  }))
}

function ReceiptThumb({
  expense,
  onOpen,
}: {
  expense: Expense
  onOpen: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const hasReceipt = Boolean(
    expense.receipt_url || expense.local_receipt_blob_key,
  )

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    void (async () => {
      const resolved = await getReceiptDisplayUrl(
        expense.receipt_url,
        expense.local_receipt_blob_key,
      )
      if (cancelled) {
        if (resolved?.startsWith('blob:')) URL.revokeObjectURL(resolved)
        return
      }
      if (resolved?.startsWith('blob:')) objectUrl = resolved
      setUrl(resolved)
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [expense.id, expense.receipt_url, expense.local_receipt_blob_key])

  if (!hasReceipt) return null

  return (
    <IonThumbnail
      slot="start"
      className="receipt-thumb"
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
    >
      {url ? (
        <img src={url} alt="" />
      ) : (
        <IonIcon icon={imageOutline} color="medium" />
      )}
    </IonThumbnail>
  )
}

export function ExpenseList({
  expenses,
  currency,
  loading,
  onEdit,
  onDelete,
}: ExpenseListProps) {
  const groups = useMemo(() => groupByDay(expenses), [expenses])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const openPreview = async (expense: Expense) => {
    const url = await getReceiptDisplayUrl(
      expense.receipt_url,
      expense.local_receipt_blob_key,
    )
    if (!url) return
    setPreviewUrl(url)
    setPreviewOpen(true)
  }

  if (loading) {
    return (
      <IonText color="medium">
        <p>Loading…</p>
      </IonText>
    )
  }

  if (expenses.length === 0) {
    return (
      <IonText color="medium">
        <p>No expenses yet. Tap + to log one.</p>
      </IonText>
    )
  }

  return (
    <>
      {groups.map((group) => (
        <IonList key={group.date} inset>
          <IonListHeader>
            <IonLabel>{group.label}</IonLabel>
          </IonListHeader>
          {group.items.map((expense) => (
            <IonItemSliding key={expense.id}>
              <IonItem button detail={false} onClick={() => onEdit(expense)}>
                <ReceiptThumb
                  expense={expense}
                  onOpen={() => void openPreview(expense)}
                />
                <IonLabel>
                  <h2>{expense.category}</h2>
                  <p>
                    {expense.description
                      ? expense.description
                      : expense.sync_status === 'pending'
                        ? 'Pending sync'
                        : '—'}
                  </p>
                </IonLabel>
                <IonNote slot="end" color="primary">
                  {formatMoney(expense.amount, currency)}
                </IonNote>
              </IonItem>
              <IonItemOptions side="end">
                <IonItemOption
                  color="danger"
                  onClick={() => void onDelete(expense.id)}
                >
                  <IonIcon slot="icon-only" icon={trashOutline} />
                </IonItemOption>
              </IonItemOptions>
            </IonItemSliding>
          ))}
        </IonList>
      ))}

      <IonModal
        isOpen={previewOpen}
        onDidDismiss={() => {
          setPreviewOpen(false)
          if (previewUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl)
          }
          setPreviewUrl(null)
        }}
        className="receipt-preview-modal"
      >
        <div className="receipt-preview-modal-body">
          {previewUrl && (
            <img src={previewUrl} alt="Receipt" className="receipt-full" />
          )}
        </div>
      </IonModal>
    </>
  )
}
