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
  listOutline,
  settingsOutline,
} from 'ionicons/icons'
import { Navigate, Route } from 'react-router-dom'
import DashboardPage from '../DashboardPage'
import ExpensesPage from '../ExpensesPage'
import SettingsPage from '../SettingsPage'

export default function TabsLayout() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/tabs/dashboard" element={<DashboardPage />} />
        <Route path="/tabs/expenses" element={<ExpensesPage />} />
        <Route path="/tabs/settings" element={<SettingsPage />} />
        <Route path="/tabs" element={<Navigate to="/tabs/dashboard" replace />} />
        <Route path="/" element={<Navigate to="/tabs/dashboard" replace />} />
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="dashboard" href="/tabs/dashboard">
          <IonIcon icon={homeOutline} />
          <IonLabel>Dashboard</IonLabel>
        </IonTabButton>
        <IonTabButton tab="expenses" href="/tabs/expenses">
          <IonIcon icon={listOutline} />
          <IonLabel>Expenses</IonLabel>
        </IonTabButton>
        <IonTabButton tab="settings" href="/tabs/settings">
          <IonIcon icon={settingsOutline} />
          <IonLabel>Settings</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  )
}
