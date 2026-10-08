import React from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuthContext } from './app/providers/AuthProvider'
import { DataProvider } from './app/providers/DataProvider'
import { LoginScreen } from './features/auth/LoginScreen'
import { HomeScreen } from './features/home/HomeScreen'

function AppRoot() {
  const { session } = useAuthContext()

  return (
    <div className="app">
      {session ? <HomeScreen /> : <LoginScreen />}
    </div>
  )
}

function Bootstrap() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppRoot />
      </DataProvider>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Bootstrap />
  </React.StrictMode>,
)
