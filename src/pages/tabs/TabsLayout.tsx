import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react'
import {
  homeOutline,
  settingsOutline,
  walletOutline,
} from 'ionicons/icons'
import { Navigate, Route } from 'react-router-dom'
import DashboardPage from '../DashboardPage'
import MoneyPage from '../MoneyPage'
import SettingsPage from '../SettingsPage'

export default function TabsLayout() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/tabs/dashboard" element={<DashboardPage />} />
        <Route path="/tabs/money" element={<MoneyPage />} />
        <Route path="/tabs/expenses" element={<Navigate to="/tabs/money" replace />} />
        <Route path="/tabs/settings" element={<SettingsPage />} />
        <Route path="/tabs" element={<Navigate to="/tabs/dashboard" replace />} />
        <Route path="/" element={<Navigate to="/tabs/dashboard" replace />} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="dashboard" href="/tabs/dashboard">
          <IonIcon icon={homeOutline} />
          <IonLabel>Dashboard</IonLabel>
        </IonTabButton>
        <IonTabButton tab="money" href="/tabs/money">
          <IonIcon icon={walletOutline} />
          <IonLabel>Money</IonLabel>
        </IonTabButton>
        <IonTabButton tab="settings" href="/tabs/settings">
          <IonIcon icon={settingsOutline} />
          <IonLabel>Settings</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  )
}
