import React from 'react'
import './styles/app.css'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './app/providers/AuthProvider'
import { DataProvider } from './app/providers/DataProvider'
import { AppRoot } from './app/AppRoot'

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
