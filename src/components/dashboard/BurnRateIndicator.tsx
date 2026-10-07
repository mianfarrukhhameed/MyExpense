import { IonNote, IonText } from '@ionic/react'
import type { BurnRateSummary } from '../../core/utils/budget'
import { formatMoney } from '../../core/utils/money'

interface BurnRateIndicatorProps {
  burn: BurnRateSummary
  currency: string
  budget: number
}

export function BurnRateIndicator({
  burn,
  currency,
  budget,
}: BurnRateIndicatorProps) {
  if (budget <= 0) {
    return (
      <IonNote color="medium">
        Burn-rate pacing needs a planned budget.
      </IonNote>
    )
  }

  if (burn.dayOfMonth === 0 || burn.actualDaily === 0) {
    return (
      <IonNote color="medium">
        No spend yet this month — pacing looks fine.
      </IonNote>
    )
  }

  return (
    <div className="burn-rate">
      <IonText color={burn.overPace ? 'danger' : 'success'}>
        <p className="burn-rate-title">
          {burn.overPace ? 'Spending too fast' : 'On pace'}
        </p>
      </IonText>
      <p className="muted">
        Actual {formatMoney(burn.actualDaily, currency)}/day vs allowed{' '}
        {formatMoney(burn.allowedDaily, currency)}/day (day {burn.dayOfMonth}/
        {burn.daysInMonth}).
      </p>
      <p className="muted">
        Projected month-end:{' '}
        <strong>{formatMoney(burn.projectedMonthEnd, currency)}</strong>
        {burn.overPace ? ' — above budget.' : ' — within budget.'}
      </p>
    </div>
  )
}
