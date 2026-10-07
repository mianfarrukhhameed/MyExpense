import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthTotal } from '../../core/utils/budget'
import { formatMoney } from '../../core/utils/money'
import { IonNote, IonText } from '@ionic/react'

interface MonthCompareChartProps {
  months: MonthTotal[]
  currency: string
}

export function MonthCompareChart({ months, currency }: MonthCompareChartProps) {
  const hasData = months.some((row) => row.total > 0)
  const maxMonth = months.find((row) => row.isMax && row.total > 0)

  if (!hasData) {
    return (
      <IonNote color="medium">
        Add expenses across months to compare spending history.
      </IonNote>
    )
  }

  return (
    <div className="month-chart">
      {maxMonth && (
        <div className="overspend-alert">
          <IonText color="warning">
            <p className="burn-rate-title">Overspending alert</p>
          </IonText>
          <p className="muted">
            Highest month: <strong>{maxMonth.label}</strong> —{' '}
            {formatMoney(maxMonth.total, currency)}
          </p>
        </div>
      )}
      <div className="month-chart-canvas">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              width={48}
              tickFormatter={(value: number) =>
                value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
              }
            />
            <Tooltip
              formatter={(value) => [
                formatMoney(Number(value ?? 0), currency),
                'Spent',
              ]}
            />
            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
              {months.map((row) => (
                <Cell
                  key={row.monthKey}
                  fill={row.isMax ? '#eb445a' : '#3880ff'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
