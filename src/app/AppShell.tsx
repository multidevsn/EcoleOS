import React from 'react'
import { canAccess, roleTabs, type Role, type Tab } from '../lib/permissions'

export function AppShell(): JSX.Element {
  const role: Role = 'student'
  const activeTab: Tab = 'home'

  return (
    <main className="app-shell" aria-label="École OS shell">
      <h1>École OS</h1>
      <p>Architecture front refactorisée et prête pour le découpage métier.</p>
      <ul>
        {roleTabs[role].map((tab) => (
          <li key={tab}>{canAccess(role, tab) ? tab : 'hidden'}</li>
        ))}
      </ul>
      <p>Current tab: {activeTab}</p>
    </main>
  )
}
