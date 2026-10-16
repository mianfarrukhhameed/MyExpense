import { IonNote, IonText } from '@ionic/react'
import { formatMoney } from '../../core/utils/money'

interface TotalLine {
  label: string
  amount: number
}

interface ListTotalBarProps {
  currency: string
  lines: TotalLine[]
  itemCount: number
  itemLabel?: string
}

export function ListTotalBar({
  currency,
  lines,
  itemCount,
  itemLabel = 'items',
}: ListTotalBarProps) {
  return (
    <div className="list-total-bar">
      <IonNote>
        {itemCount === 1 ? `1 ${itemLabel.replace(/s$/, '')}` : `${itemCount} ${itemLabel}`}
      </IonNote>
      <div className="list-total-amounts">
        {lines.map((line) => (
          <IonText key={line.label} color="primary">
            <p className="list-total-line">
              <span className="list-total-label">{line.label}</span>
              <strong>{formatMoney(line.amount, currency)}</strong>
            </p>
          </IonText>
        ))}
      </div>
    </div>
  )
}
