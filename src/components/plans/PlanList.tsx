import {
  IonButton,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonText,
} from '@ionic/react'
import type { PlanExpense } from '../../core/types/plan'
import { formatDayLabel } from '../../core/utils/date'
import { formatMoney } from '../../core/utils/money'

interface PlanListProps {
  plans: PlanExpense[]
  currency: string
  loading?: boolean
  onEdit: (plan: PlanExpense) => void
  onDelete: (id: string) => Promise<void>
  onMarkPaid: (plan: PlanExpense) => Promise<void>
}

export function PlanList({
  plans,
  currency,
  loading,
  onEdit,
  onDelete,
  onMarkPaid,
}: PlanListProps) {
  if (loading) {
    return (
      <IonText color="medium">
        <p>Loading…</p>
      </IonText>
    )
  }

  if (plans.length === 0) {
    return (
      <IonText color="medium">
        <p>No plans for this filter. Tap + to add an upcoming expense.</p>
      </IonText>
    )
  }

  return (
    <IonList inset>
      {plans.map((plan) => (
        <IonItemSliding key={plan.id}>
          <IonItem button detail={false} onClick={() => onEdit(plan)}>
            <IonLabel>
              <h2>{plan.category}</h2>
              <p>
                Due {formatDayLabel(plan.due_date)}
                {plan.recurrence === 'monthly' ? ' · Monthly' : ''}
                {plan.description ? ` · ${plan.description}` : ''}
              </p>
            </IonLabel>
            <div slot="end" className="plan-item-end">
              <IonNote color="primary">
                {formatMoney(plan.amount, currency)}
              </IonNote>
              {plan.status === 'upcoming' && (
                <IonButton
                  size="small"
                  fill="outline"
                  onClick={(event) => {
                    event.stopPropagation()
                    void onMarkPaid(plan)
                  }}
                >
                  Paid
                </IonButton>
              )}
            </div>
          </IonItem>
          <IonItemOptions side="end">
            <IonItemOption
              color="danger"
              onClick={() => void onDelete(plan.id)}
            >
              Delete
            </IonItemOption>
          </IonItemOptions>
        </IonItemSliding>
      ))}
    </IonList>
  )
}
