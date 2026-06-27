import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('selects a weekly verse and starts the covered recall flow', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Choose this week’s verse.' })).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Search reference or words…'), { target: { value: 'I Thessalonians 5:14-15' } })
    fireEvent.click(screen.getByRole('button', { name: /I Thessalonians 5:14-15/ }))

    expect(screen.getByRole('heading', { name: 'I Thessalonians 5:14-15' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mark natural stopping points' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start memorizing →' }))

    expect(screen.getByRole('heading', { name: 'Learn chunks' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cover & recall/ }))
    expect(screen.getByText('Say it out loud.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reveal & check/ }))
    expect(screen.getByRole('button', { name: /Got it/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Got it/ }))

    expect(screen.getByText('Clean recalls: 0/2')).toBeInTheDocument()
    expect(localStorage.getItem('verse-memory-v2')).toContain('anchorVerseId')
  })
})
