import { IonApp, setupIonicReact } from '@ionic/react'
import { IonReactRouter } from '@ionic/react-router'
import { LocalDataProvider } from './hooks/local-data'
import TabsLayout from './pages/tabs/TabsLayout'

setupIonicReact()

export default function App() {
  return (
    <IonApp>
      <LocalDataProvider>
        <IonReactRouter>
          <TabsLayout />
        </IonReactRouter>
      </LocalDataProvider>
    </IonApp>
  )
}
