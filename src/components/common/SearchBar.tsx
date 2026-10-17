import { IonLabel, IonSearchbar, IonSegment, IonSegmentButton } from '@ionic/react'

export type SearchMode = 'contains' | 'similar'

interface SearchBarProps {
  value: string
  placeholder?: string
  onChange: (value: string) => void
  mode?: SearchMode
  onModeChange?: (mode: SearchMode) => void
  similarAvailable?: boolean
}

export function SearchBar({
  value,
  placeholder = 'Search',
  onChange,
  mode = 'contains',
  onModeChange,
  similarAvailable = false,
}: SearchBarProps) {
  return (
    <div className="money-search-wrap">
      <IonSearchbar
        value={value}
        debounce={200}
        placeholder={placeholder}
        onIonInput={(event) => onChange(event.detail.value ?? '')}
        className="money-search"
      />
      {onModeChange && (
        <IonSegment
          value={mode}
          className="search-mode-segment"
          onIonChange={(event) => {
            const next = (event.detail.value as SearchMode) ?? 'contains'
            if (next === 'similar' && !similarAvailable) return
            onModeChange(next)
          }}
        >
          <IonSegmentButton value="contains">
            <IonLabel>Contains</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="similar" disabled={!similarAvailable}>
            <IonLabel>Similar</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      )}
    </div>
  )
}
