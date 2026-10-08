import {describe, expect, it} from 'vitest'
import {describeError, isMissingSchemaError} from '../src/lib/errors'

describe('describeError', () => {
  it('turns network failures into a clear, retryable message', () => {
    expect(describeError(new TypeError('Failed to fetch'))).toMatchObject({
      kind: 'network',
      retryable: true,
      message: 'Connexion Internet indisponible. Vérifiez votre réseau puis réessayez.',
    })
  })

  it('does not expose database permission details to the user', () => {
    const technical = 'permission denied for table private_profiles'
    const result = describeError(new Error(technical), 'Impossible de charger les données.')

    expect(result.kind).toBe('permission')
    expect(result.message).not.toContain(technical)
    expect(result.technical).toContain(technical)
  })

  it('keeps safe, already-localized API messages', () => {
    expect(describeError(new Error('Code de parrainage invalide.')).message)
      .toBe('Code de parrainage invalide.')
  })

  it('uses the contextual fallback for unrecognized technical errors', () => {
    const result = describeError(new Error('TypeError: Cannot read properties of undefined'), 'Action impossible pour le moment.')

    expect(result.kind).toBe('unknown')
    expect(result.message).toBe('Action impossible pour le moment.')
    expect(result.technical).toContain('TypeError')
  })

  it('recognizes an outdated application chunk and recommends a reload', () => {
    expect(describeError(new Error('Failed to fetch dynamically imported module'))).toMatchObject({
      kind: 'stale_version',
      retryable: true,
      message: 'Une nouvelle version d’École OS est disponible. Rechargez la page pour continuer.',
    })
  })

  it('detects missing Supabase tables so demo screens can use a local fallback', () => {
    expect(isMissingSchemaError({
      code: 'PGRST205',
      message: 'Could not find the table public.food_items in the schema cache',
    })).toBe(true)
    expect(isMissingSchemaError(new TypeError('Failed to fetch'))).toBe(false)
  })
})
