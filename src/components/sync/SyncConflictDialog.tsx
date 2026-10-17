import {
  IonButton,
  IonContent,
  IonHeader,
  IonModal,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react'
import {
  summarizeConflictReport,
  type SyncConflictChoice,
  type SyncConflictReport,
} from '../../services/sync/conflict'

interface SyncConflictDialogProps {
  report: SyncConflictReport | null
  onChoice: (choice: SyncConflictChoice) => void
}

/** Modal (not IonAlert) so browser agents can click stable test ids. */
export function SyncConflictDialog({
  report,
  onChoice,
}: SyncConflictDialogProps) {
  const open = Boolean(report)
  const message = report
    ? `${summarizeConflictReport(report)}\n\nUse cloud data, overwrite cloud with this device, or cancel (keep both as-is).`
    : ''

  return (
    <IonModal
      isOpen={open}
      backdropDismiss={false}
      data-testid="sync-conflict-dialog"
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>Data differs from cloud</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonText>
          <p style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
        </IonText>
        <div className="conflict-actions">
          <IonButton
            expand="block"
            data-testid="conflict-use-cloud"
            onClick={() => onChoice('use_cloud')}
          >
            Use cloud
          </IonButton>
          <IonButton
            expand="block"
            fill="outline"
            data-testid="conflict-overwrite"
            onClick={() => onChoice('push_local')}
          >
            Overwrite cloud
          </IonButton>
          <IonButton
            expand="block"
            fill="clear"
            color="medium"
            data-testid="conflict-cancel"
            onClick={() => onChoice('cancel')}
          >
            Cancel
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  )
}
