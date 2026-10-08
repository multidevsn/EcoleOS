/** @vitest-environment jsdom */
import React from 'react'
import {fireEvent, render, screen} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Food} from '../src/screens-core'
import {createDemoData} from '../src/demoFixtures'

const {supabaseFrom, supabaseModuleLoads} = vi.hoisted(() => ({
  supabaseFrom: vi.fn(),
  supabaseModuleLoads: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => {
  supabaseModuleLoads()
  return {supabase: {from: supabaseFrom}}
})

describe('Food in local demo mode', () => {
  beforeEach(() => {
    supabaseFrom.mockClear()
    supabaseModuleLoads.mockClear()
  })

  it('shows the local menu and cart, and labels checkout as a local simulation', () => {
    const checkout = vi.fn()
    const setCart = vi.fn()
    const data = createDemoData('student')
    const {container} = render(
      <Food
        role="student"
        mode="demo"
        data={data}
        cart={{burger: 1}}
        setCart={setCart}
        checkout={checkout}
        message=""
      />,
    )

    expect(container.querySelectorAll('.food-card')).toHaveLength(4)
    expect(container.querySelector('.cart')).not.toBeNull()
    expect(screen.getByRole('heading', {name: 'Ma commande'})).not.toBeNull()
    expect(screen.getByText(/Données fictives/i)).not.toBeNull()
    expect(screen.getByText(/aucun paiement réel/i)).not.toBeNull()

    fireEvent.click(screen.getByRole('button', {name: 'Simuler la commande'}))
    expect(checkout).toHaveBeenCalledOnce()
    expect(supabaseModuleLoads).not.toHaveBeenCalled()
    expect(supabaseFrom).not.toHaveBeenCalled()
  })
})
