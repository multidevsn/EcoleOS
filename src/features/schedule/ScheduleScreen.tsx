import React from 'react'
import type { Role } from '../../lib/permissions'

type ScheduleScreenProps = {
  role: Role
}

export function ScheduleScreen({ role }: ScheduleScreenProps) {
  const todaySchedule = [
    { id: '1', time: '08:30', subject: 'Mathématiques', room: 'A1' },
    { id: '2', time: '10:00', subject: 'Physique', room: 'B2' },
    { id: '3', time: '13:30', subject: 'Français', room: 'C3' },
  ]

  return (
    <section className="panel">
      <h2>Emploi du temps</h2>
      <p>Rôle actif : {role}</p>
      <p>Planning, cours du jour, emploi du temps global.</p>

      <div className="grid stats">
        <div className="card">
          <strong>3</strong>
          <span>Cours aujourd'hui</span>
        </div>
        <div className="card">
          <strong>2h30</strong>
          <span>Temps total</span>
        </div>
        <div className="card">
          <strong>4</strong>
          <span>Prochains cours</span>
        </div>
      </div>

      <div className="panel mt-lg">
        <h3>Planning du jour</h3>
        {todaySchedule.map((entry) => (
          <div key={entry.id} className="card mt-lg">
            <strong>{entry.time}</strong>
            <span>{entry.subject}</span>
            <small>Salle {entry.room}</small>
          </div>
        ))}
      </div>
    </section>
  )
}
