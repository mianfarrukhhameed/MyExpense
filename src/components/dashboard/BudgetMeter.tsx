import { IonNote, IonProgressBar, IonText } from '@ionic/react'
import type { MonthBudgetSummary } from '../../core/utils/budget'
import { formatMoney } from '../../core/utils/money'

interface BudgetMeterProps {
  summary: MonthBudgetSummary
  currency: string
}

export function BudgetMeter({ summary, currency }: BudgetMeterProps) {
  const remainingLabel = summary.overspent
    ? `Over by ${formatMoney(Math.abs(summary.remaining), currency)}`
    : formatMoney(Math.max(0, summary.remaining), currency)

  return (
    <div className="budget-meter">
      <div className="budget-meter-row">
        <div>
          <IonText color="medium">
            <p className="muted">Planned</p>
          </IonText>
          <div className="stat-value">{formatMoney(summary.budget, currency)}</div>
        </div>
        <div>
          <IonText color="medium">
            <p className="muted">Spent</p>
          </IonText>
          <div className="stat-value">{formatMoney(summary.spent, currency)}</div>
        </div>
        <div>
          <IonText color="medium">
            <p className="muted">{summary.overspent ? 'Overspent' : 'Remaining'}</p>
          </IonText>
          <div
            className={`stat-value${summary.overspent ? ' stat-danger' : ''}`}
          >
            {remainingLabel}
          </div>
        </div>
      </div>
      <IonProgressBar
        value={summary.progress}
        color={summary.overspent ? 'danger' : 'primary'}
        className="budget-progress"
      />
      {summary.budget <= 0 && (
        <IonNote color="medium" className="ion-margin-top">
          Set a monthly budget in Settings to track remaining spend.
        </IonNote>
      )}
    </div>
  )
}
