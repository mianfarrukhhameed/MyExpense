import {
  IonButton,
  IonButtons,
  IonIcon,
  IonSelect,
  IonSelectOption,
} from '@ionic/react'
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons'
import {
  formatMonthLabel,
  recentMonthKeys,
  shiftMonthKey,
  toMonthKey,
} from '../../core/utils/date'

interface MonthFilterBarProps {
  /** null = All months */
  monthKey: string | null
  onChange: (monthKey: string | null) => void
}

export function MonthFilterBar({ monthKey, onChange }: MonthFilterBarProps) {
  const options = recentMonthKeys(18)
  const current = toMonthKey()

  return (
    <div className="month-filter-bar">
      <IonButtons>
        <IonButton
          fill="clear"
          disabled={!monthKey}
          onClick={() => {
            if (!monthKey) return
            onChange(shiftMonthKey(monthKey, -1))
          }}
        >
          <IonIcon slot="icon-only" icon={chevronBackOutline} />
        </IonButton>
      </IonButtons>

      <IonSelect
        interface="popover"
        value={monthKey ?? 'all'}
        className="month-filter-select"
        onIonChange={(event) => {
          const value = String(event.detail.value)
          onChange(value === 'all' ? null : value)
        }}
      >
        <IonSelectOption value="all">All months</IonSelectOption>
        {options.map((key) => (
          <IonSelectOption key={key} value={key}>
            {formatMonthLabel(key)}
            {key === current ? ' (current)' : ''}
          </IonSelectOption>
        ))}
      </IonSelect>

      <IonButtons>
        <IonButton
          fill="clear"
          disabled={!monthKey || monthKey >= current}
          onClick={() => {
            if (!monthKey) return
            const next = shiftMonthKey(monthKey, 1)
            if (next > current) return
            onChange(next)
          }}
        >
          <IonIcon slot="icon-only" icon={chevronForwardOutline} />
        </IonButton>
      </IonButtons>
    </div>
  )
}
