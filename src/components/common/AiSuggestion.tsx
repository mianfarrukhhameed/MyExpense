import { IonButton, IonNote, IonSpinner } from '@ionic/react'

interface AiSuggestionProps {
  label: string
  value: string | null
  loading?: boolean
  onAccept: () => void
  onDismiss: () => void
}

/** Non-destructive AI suggestion strip with Accept / Dismiss. */
export function AiSuggestion({
  label,
  value,
  loading = false,
  onAccept,
  onDismiss,
}: AiSuggestionProps) {
  if (loading && !value) {
    return (
      <div className="ai-suggestion">
        <IonSpinner name="crescent" className="ai-suggestion-spinner" />
        <IonNote color="medium">Suggesting…</IonNote>
      </div>
    )
  }

  if (!value) return null

  return (
    <div className="ai-suggestion">
      <IonNote color="medium" className="ai-suggestion-text">
        {label}: <strong>{value}</strong>
      </IonNote>
      <div className="ai-suggestion-actions">
        <IonButton size="small" fill="solid" onClick={onAccept}>
          Use this
        </IonButton>
        <IonButton size="small" fill="clear" onClick={onDismiss}>
          Dismiss
        </IonButton>
      </div>
    </div>
  )
}
