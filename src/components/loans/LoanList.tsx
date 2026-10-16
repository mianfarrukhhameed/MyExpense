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
import type { Loan } from '../../core/types/loan'
import { formatDayLabel } from '../../core/utils/date'
import { formatMoney } from '../../core/utils/money'

interface LoanListProps {
  loans: Loan[]
  currency: string
  loading?: boolean
  onEdit: (loan: Loan) => void
  onDelete: (id: string) => Promise<void>
  onPay: (loan: Loan) => void
}

export function LoanList({
  loans,
  currency,
  loading,
  onEdit,
  onDelete,
  onPay,
}: LoanListProps) {
  if (loading) {
    return (
      <IonText color="medium">
        <p>Loading…</p>
      </IonText>
    )
  }

  if (loans.length === 0) {
    return (
      <IonText color="medium">
        <p>No loans for this filter. Tap + to add one.</p>
      </IonText>
    )
  }

  return (
    <IonList inset>
      {loans.map((loan) => (
        <IonItemSliding key={loan.id}>
          <IonItem button detail={false} onClick={() => onEdit(loan)}>
            <IonLabel>
              <h2>
                {loan.person}{' '}
                <span className="loan-direction">
                  {loan.direction === 'borrowed' ? '· Borrowed' : '· Lent'}
                </span>
              </h2>
              <p>
                {loan.direction === 'borrowed'
                  ? `Due ${formatDayLabel(loan.due_date)}`
                  : `Since ${formatDayLabel(loan.loan_date)}`}
                {loan.remaining <= 0 ? ' · Settled' : ''}
                {loan.description ? ` · ${loan.description}` : ''}
              </p>
            </IonLabel>
            <div slot="end" className="plan-item-end">
              <IonNote color={loan.remaining > 0 ? 'primary' : 'medium'}>
                {formatMoney(loan.remaining, currency)}
              </IonNote>
              {loan.remaining > 0 && (
                <IonButton
                  size="small"
                  fill="outline"
                  onClick={(event) => {
                    event.stopPropagation()
                    onPay(loan)
                  }}
                >
                  Pay
                </IonButton>
              )}
            </div>
          </IonItem>
          <IonItemOptions side="end">
            <IonItemOption
              color="danger"
              onClick={() => void onDelete(loan.id)}
            >
              Delete
            </IonItemOption>
          </IonItemOptions>
        </IonItemSliding>
      ))}
    </IonList>
  )
}
