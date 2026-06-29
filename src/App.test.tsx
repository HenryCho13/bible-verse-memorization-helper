import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/')
    localStorage.clear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => cleanup())

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

  it('grades a typed recall and allows overriding the assigned pile', () => {
    render(<App />)

    fireEvent.change(screen.getByPlaceholderText('Search reference or words…'), { target: { value: 'I Thessalonians 5:14-15' } })
    fireEvent.click(screen.getByRole('button', { name: /I Thessalonians 5:14-15/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Start memorizing →' }))
    fireEvent.click(screen.getByRole('button', { name: /Cover & recall/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Type your answer' }))

    const answer = screen.getByRole('textbox', { name: 'Type from memory' })
    fireEvent.keyDown(answer, { code: 'Space', key: ' ' })
    expect(answer).toBeInTheDocument()
    fireEvent.change(answer, { target: { value: 'now we exhort you brethren warn those who are unruly' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }))

    expect(screen.getByRole('heading', { name: 'Got it' })).toBeInTheDocument()
    expect(screen.getByText('Exact words after ignoring punctuation and capitalization.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Hard →' }))
    expect(screen.getByText('Targeted correction')).toBeInTheDocument()
  })

  it('opens the one-time Joel event route without changing the weekly plan', () => {
    window.history.pushState(null, '', '/event/2026-ec-yao-retreat-2')

    render(<App />)

    expect(screen.getByRole('heading', { name: 'Joel 2:28-32' })).toBeInTheDocument()
    expect(screen.getByText('2026 EC YAO Retreat 2')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Choose this week’s verse.' })).not.toBeInTheDocument()
    expect(screen.getByText(/And it shall come to pass afterward/)).toBeInTheDocument()
    expect(screen.queryByText('28')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Start memorizing →' }))

    expect(screen.getByRole('heading', { name: 'Learn chunks' })).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem('verse-memory-v2') ?? '{}')
    expect(saved.plan).toBeUndefined()
    expect(saved.sessions['event:2026-ec-yao-retreat-2'].verseId).toBe(10001)
  })
})
