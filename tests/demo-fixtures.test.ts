import {describe, expect, it} from 'vitest'
import {createDemoData} from '../src/demoFixtures'
import {demoRoleIds} from '../src/appModel'

describe('local demo fixtures', () => {
  it('provides a complete student space without depending on Supabase', () => {
    const data = createDemoData('student')

    expect(data.error).toBeNull()
    expect(data.loading).toBe(false)
    expect(data.profile).toMatchObject({
      id: demoRoleIds.student,
      full_name: 'Amadou Ndiaye',
      role: 'student',
      class_name: 'Terminale S2',
    })
    expect(data.studentId).toBe(demoRoleIds.student)
    expect(data.grades).toHaveLength(5)
    expect(data.schedule.length).toBeGreaterThan(0)
    expect(data.payments.some(payment => payment.status === 'pending')).toBe(true)
    expect(data.points.reduce((sum, entry) => sum + entry.points, 0)).toBe(1240)
    expect(data.foodItems.map(item => item.name)).toEqual([
      'Burger maison',
      'Sandwich poulet',
      'Mini pizza',
      'Boisson',
    ])
    expect(data.orders.length).toBeGreaterThan(0)
  })

  it('provides a local profile for each demo role', () => {
    for (const role of ['student', 'parent', 'teacher', 'admin', 'director', 'cafeteria'] as const) {
      const data = createDemoData(role)
      expect(data.profile?.role).toBe(role)
      expect(data.error).toBeNull()
    }
  })
})
