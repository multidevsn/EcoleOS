import React from 'react'
import type { Role } from '../../lib/permissions'

type FoodScreenProps = {
  role: Role
}

export function FoodScreen({ role }: FoodScreenProps) {
  return (
    <section className="panel">
      <h2>Food</h2>
      <p>Rôle actif : {role}</p>
      <p>Gestion de la cantine, des commandes et du menu.</p>
      <div className="grid stats">
        <div className="card">
          <strong>48</strong>
          <span>Commandes</span>
        </div>
        <div className="card">
          <strong>12</strong>
          <span>Produits</span>
        </div>
        <div className="card">
          <strong>4.2</strong>
          <span>Note moyenne</span>
        </div>
      </div>
    </section>
  )
}
