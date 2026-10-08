import React from 'react'
import { useAuthContext } from '../../app/providers/AuthProvider'
import { useDataContext } from '../../app/providers/DataProvider'

export function HomeScreen() {
  const { role } = useAuthContext()
  const { data } = useDataContext()

  return (
    <section className="panel">
      <h1>Espace {role}</h1>
      <p>Bienvenue dans votre espace École OS.</p>

      <div className="grid stats">
        <div className="card">
          <strong>{data.grades.length}</strong>
          <span>Notes</span>
        </div>
        <div className="card">
          <strong>{data.payments.length}</strong>
          <span>Payments</span>
        </div>
        <div className="card">
          <strong>{data.schedule.length}</strong>
          <span>Planning</span>
        </div>
      </div>
    </section>
  )
}
