import { IonSearchbar } from '@ionic/react'

interface SearchBarProps {
  value: string
  placeholder?: string
  onChange: (value: string) => void
}

export function SearchBar({
  value,
  placeholder = 'Search',
  onChange,
}: SearchBarProps) {
  return (
    <IonSearchbar
      value={value}
      debounce={200}
      placeholder={placeholder}
      onIonInput={(event) => onChange(event.detail.value ?? '')}
      className="money-search"
    />
  )
}
