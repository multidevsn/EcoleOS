/** @vitest-environment jsdom */
import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import {ErrorNotice} from '../src/ui'

describe('ErrorNotice', () => {
  it('does not repeat an already-translated message as a technical detail', () => {
    const message = 'Cette fonctionnalité n’est pas encore activée sur ce serveur.'
    render(<ErrorNotice error={message} />)

    expect(screen.getByRole('alert').textContent).toContain(message)
    expect(screen.queryByText('Détails techniques')).toBeNull()
  })

  it('keeps the retry action available for transient errors', () => {
    const retry = vi.fn()
    render(<ErrorNotice error={new TypeError('Failed to fetch')} onRetry={retry} />)

    fireEvent.click(screen.getByRole('button', {name: /réessayer/i}))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
