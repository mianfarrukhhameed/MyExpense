import { IonApp, IonRouterOutlet, IonSpinner, setupIonicReact } from '@ionic/react'
import { IonReactRouter } from '@ionic/react-router'
import { Navigate, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { LocalDataProvider } from './hooks/local-data'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import TabsLayout from './pages/tabs/TabsLayout'

setupIonicReact()

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <IonSpinner name="crescent" />
      </div>
    )
  }

  if (!user) {
    return (
      <IonRouterOutlet>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </IonRouterOutlet>
    )
  }

  return (
    <LocalDataProvider>
      <TabsLayout />
    </LocalDataProvider>
  )
}

export default function App() {
  return (
    <IonApp>
      <AuthProvider>
        <IonReactRouter>
          <AppRoutes />
        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  )
}
