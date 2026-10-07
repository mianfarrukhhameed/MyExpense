import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react'
import type { ReactNode } from 'react'

interface PageScaffoldProps {
  title: string
  children: ReactNode
  fullscreen?: boolean
  fab?: ReactNode
}

export function PageScaffold({
  title,
  children,
  fullscreen = true,
  fab,
}: PageScaffoldProps) {
  return (
    <IonPage>
      <IonHeader translucent={fullscreen}>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen={fullscreen}>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">{title}</IonTitle>
          </IonToolbar>
        </IonHeader>
        {children}
      </IonContent>
      {fab}
    </IonPage>
  )
}
