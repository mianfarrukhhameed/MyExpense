import { IonAlert } from '@ionic/react'
import {
  summarizeConflictReport,
  type SyncConflictChoice,
  type SyncConflictReport,
} from '../../services/sync/conflict'

interface SyncConflictDialogProps {
  report: SyncConflictReport | null
  onChoice: (choice: SyncConflictChoice) => void
}

export function SyncConflictDialog({
  report,
  onChoice,
}: SyncConflictDialogProps) {
  const open = Boolean(report)
  const message = report
    ? `${summarizeConflictReport(report)}\n\nUse cloud data, overwrite cloud with this device, or cancel (keep both as-is).`
    : ''

  return (
    <IonAlert
      isOpen={open}
      backdropDismiss={false}
      header="Data differs from cloud"
      message={message}
      buttons={[
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => onChoice('cancel'),
        },
        {
          text: 'Overwrite cloud',
          handler: () => onChoice('push_local'),
        },
        {
          text: 'Use cloud',
          role: 'confirm',
          handler: () => onChoice('use_cloud'),
        },
      ]}
    />
  )
}
