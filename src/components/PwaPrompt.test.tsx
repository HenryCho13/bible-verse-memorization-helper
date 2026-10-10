import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PwaPrompt } from './PwaPrompt'

const pwa = vi.hoisted(() => ({
  offlineReady: false,
  needRefresh: false,
  updateServiceWorker: vi.fn(),
}))

vi.mock('virtual:pwa-register/react', async () => {
  const { useState } = await import('react')
  return {
    useRegisterSW: () => ({
      offlineReady: useState(pwa.offlineReady),
      needRefresh: useState(pwa.needRefresh),
      updateServiceWorker: pwa.updateServiceWorker,
    }),
  }
})

describe('PwaPrompt', () => {
  beforeEach(() => {
    pwa.offlineReady = false
    pwa.needRefresh = false
    pwa.updateServiceWorker.mockReset().mockResolvedValue(undefined)
  })
  afterEach(cleanup)

  it('stays hidden until offline use or an update is ready', () => {
    render(<PwaPrompt />)
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('lets users dismiss offline readiness', () => {
    pwa.offlineReady = true
    render(<PwaPrompt />)
    expect(screen.getByRole('status')).toHaveTextContent('Ready for offline practice.')
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('defers an update without reloading an active practice session', () => {
    pwa.needRefresh = true
    render(<PwaPrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
  })

  it('only activates the update after the user chooses to reload', async () => {
    pwa.needRefresh = true
    pwa.offlineReady = true
    render(<PwaPrompt />)
    expect(screen.getByRole('status')).toHaveTextContent('A new version')
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reload to update' }))
    await waitFor(() => expect(pwa.updateServiceWorker).toHaveBeenCalledWith(true))
  })

  it('allows retrying a failed update', async () => {
    pwa.needRefresh = true
    pwa.updateServiceWorker.mockRejectedValueOnce(new Error('offline'))
    render(<PwaPrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Reload to update' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update')
    fireEvent.click(screen.getByRole('button', { name: 'Reload to update' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(pwa.updateServiceWorker).toHaveBeenCalledTimes(2)
  })

  it('keeps prompt keyboard actions from triggering practice shortcuts', () => {
    pwa.needRefresh = true
    const shortcut = vi.fn()
    document.addEventListener('keydown', shortcut)
    try {
      render(<PwaPrompt />)
      fireEvent.keyDown(screen.getByRole('button', { name: 'Later' }), { key: ' ', code: 'Space' })
      expect(shortcut).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', shortcut)
    }
  })
})
