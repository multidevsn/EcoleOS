import React from 'react'
import type { Role } from '../../lib/permissions'

type GradesScreenProps = {
  role: Role
}

export function GradesScreen({ role }: GradesScreenProps) {
  return (
    <section className="panel">
      <h2>Notes</h2>
      <p>Rôle actif : {role}</p>
      <p>Liste des notes, moyenne, matières et appréciations.</p>
    </section>
  )
}
