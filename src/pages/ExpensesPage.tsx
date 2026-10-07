import {
  IonFab,
  IonFabButton,
  IonIcon,
  IonNote,
  useIonToast,
} from '@ionic/react'
import { addOutline } from 'ionicons/icons'
import { useState } from 'react'
import {
  ExpenseFormModal,
  type ExpenseFormValues,
} from '../components/expenses/ExpenseFormModal'
import { ExpenseList } from '../components/expenses/ExpenseList'
import { PageScaffold } from '../components/common/PageScaffold'
import type { Expense } from '../core/types/expense'
import { useExpenses } from '../hooks/useExpenses'
import { useProfile } from '../hooks/useProfile'

export default function ExpensesPage() {
  const { expenses, count, loading, addExpense, updateExpense, deleteExpense } =
    useExpenses()
  const { profile } = useProfile()
  const currency = profile?.currency ?? 'USD'
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [present] = useIonToast()

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (expense: Expense) => {
    setEditing(expense)
    setFormOpen(true)
  }

  const handleSubmit = async (values: ExpenseFormValues) => {
    if (editing) {
      await updateExpense(editing.id, {
        amount: values.amount,
        category: values.category,
        description: values.description,
        date: values.date,
        receiptFile: values.receiptFile,
        clearReceipt: values.clearReceipt,
      })
      await present({
        message: 'Expense updated',
        duration: 1500,
        color: 'success',
      })
    } else {
      await addExpense({
        amount: values.amount,
        category: values.category,
        description: values.description,
        date: values.date,
        receiptFile: values.receiptFile,
      })
      await present({
        message: 'Expense saved',
        duration: 1500,
        color: 'success',
      })
    }
  }

  const handleDelete = async (id: string) => {
    await deleteExpense(id)
    await present({
      message: 'Expense deleted',
      duration: 1500,
      color: 'medium',
    })
  }

  return (
    <PageScaffold
      title="Expenses"
      fab={
        <IonFab slot="fixed" vertical="bottom" horizontal="end">
          <IonFabButton onClick={openCreate}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>
      }
    >
      <div className="page-section">
        <IonNote className="expense-count">
          {count === 1 ? '1 expense' : `${count} expenses`}
        </IonNote>

        <ExpenseList
          expenses={expenses}
          currency={currency}
          loading={loading}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      </div>

      <ExpenseFormModal
        isOpen={formOpen}
        expense={editing}
        onDismiss={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
      />
    </PageScaffold>
  )
}
