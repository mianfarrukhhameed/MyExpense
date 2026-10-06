import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonText,
} from '@ionic/react'
import { PageScaffold } from '../components/common/PageScaffold'
import { formatMoney } from '../core/utils/money'
import { useExpenses } from '../hooks/useExpenses'
import { useProfile } from '../hooks/useProfile'

export default function ExpensesPage() {
  const { expenses, count, loading } = useExpenses()
  const { profile } = useProfile()
  const currency = profile?.currency ?? 'USD'

  return (
    <PageScaffold title="Expenses">
      <div className="page-section">
        <IonCard className="page-card">
          <IonCardHeader>
            <IonCardSubtitle>Local history</IonCardSubtitle>
            <IonCardTitle>
              {count === 1 ? '1 expense' : `${count} expenses`}
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonNote>
              Full logging form, swipe-to-delete, and receipts arrive in Phase 3.
              Use Settings to add a sample expense for now.
            </IonNote>
          </IonCardContent>
        </IonCard>

        {loading ? (
          <IonText color="medium">
            <p>Loading…</p>
          </IonText>
        ) : expenses.length === 0 ? (
          <IonText color="medium">
            <p>No expenses yet.</p>
          </IonText>
        ) : (
          <IonList inset>
            {expenses.map((expense) => (
              <IonItem key={expense.id}>
                <IonLabel>
                  <h2>{expense.category}</h2>
                  <p>
                    {expense.date}
                    {expense.description ? ` · ${expense.description}` : ''}
                  </p>
                </IonLabel>
                <IonNote slot="end" color="primary">
                  {formatMoney(expense.amount, currency)}
                </IonNote>
              </IonItem>
            ))}
          </IonList>
        )}
      </div>
    </PageScaffold>
  )
}
