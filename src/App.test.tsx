import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/')
    localStorage.clear()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => cleanup())

  function startWeekly() {
    fireEvent.change(screen.getByPlaceholderText('Search reference or words…'), { target: { value: 'I Thessalonians 5:14-15' } })
    fireEvent.click(screen.getByRole('button', { name: /I Thessalonians 5:14-15/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Start memorizing →' }))
  }

  it('uses the saved parts in listen mode without advancing recall progress', () => {
    render(<App />)
    startWeekly()
    const saved = localStorage.getItem('verse-memory-v2')
    fireEvent.click(screen.getByRole('button', { name: 'Listen mode' }))
    expect(screen.getByRole('heading', { name: 'Listen mode' })).toBeInTheDocument()
    expect(screen.getByText('Now we exhort you, brethren, warn those who are unruly,')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next part' }))
    fireEvent.keyDown(document, { key: 's' })
    fireEvent.keyDown(document, { code: 'Space', key: ' ' })
    expect(localStorage.getItem('verse-memory-v2')).toBe(saved)
    fireEvent.click(screen.getByRole('button', { name: '← Back to practice' }))
    expect(screen.getByRole('heading', { name: 'Learn chunks' })).toBeInTheDocument()
    expect(screen.getByText('Clean recalls: 0/2')).toBeInTheDocument()
  })

  it('toggles the full verse without losing a covered or typed recall', () => {
    render(<App />)
    startWeekly()
    fireEvent.keyDown(document, { key: ' ', code: 'Space' })
    fireEvent.keyDown(document, { key: 'f' })
    expect(screen.getByRole('region', { name: 'Full verse reference' })).toHaveTextContent('Now we exhort you')
    expect(screen.getByText('Say it out loud.')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'f', repeat: true })
    expect(screen.getByRole('button', { name: 'Hide full verse' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'f' })
    fireEvent.keyDown(document, { key: 'Enter' })
    const answer = screen.getByRole('textbox', { name: 'Type from memory' })
    fireEvent.change(answer, { target: { value: 'first words' } })
    fireEvent.keyDown(answer, { key: 'f' })
    fireEvent.keyDown(answer, { key: 's' })
    fireEvent.keyDown(document, { key: 's', ctrlKey: true })
    expect(screen.queryByRole('region', { name: 'Full verse reference' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Learn chunks' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show full verse' }))
    expect(answer).toHaveValue('first words')
  })

  it('skips stages with shortcuts, persists the result, and keeps final recall required', () => {
    const rendered = render(<App />)
    startWeekly()
    fireEvent.keyDown(document, { key: 's' })
    expect(screen.getByRole('heading', { name: 'Pair chunks' })).toBeInTheDocument()
    expect(screen.getByText('Skipped')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'S', shiftKey: true })
    expect(screen.getByRole('heading', { name: 'Full recitation' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Skip this stage' })).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 's' })
    expect(screen.queryByText('Session complete')).not.toBeInTheDocument()
    rendered.unmount()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Full recitation' })).toBeInTheDocument()
    expect(screen.getAllByText('Skipped')).toHaveLength(5)
  })

  it('keeps personal practice separate and preserves it when changing the weekly plan', () => {
    const rendered = render(<App />)
    startWeekly()
    const originalPlan = JSON.parse(localStorage.getItem('verse-memory-v2')!).plan
    fireEvent.click(screen.getByRole('link', { name: 'My verses' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Reference' }), { target: { value: 'Psalm 23:1' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Verse text' }), { target: { value: 'The LORD is my shepherd; I shall not want.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add to My verses' }))
    fireEvent.click(screen.getByRole('button', { name: 'Practice Psalm 23:1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start memorizing →' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skip this stage' }))
    let saved = JSON.parse(localStorage.getItem('verse-memory-v2')!)
    expect(saved.plan).toEqual(originalPlan)
    expect(saved.sessions['personal:-1'].stageIndex).toBe(1)
    fireEvent.click(screen.getByRole('link', { name: 'Weekly practice' }))
    expect(screen.getByRole('heading', { name: 'Learn chunks' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change plan' }))
    saved = JSON.parse(localStorage.getItem('verse-memory-v2')!)
    expect(saved.personalVerses).toHaveLength(1)
    expect(Object.keys(saved.sessions)).toEqual(['personal:-1'])
    fireEvent.click(screen.getByRole('link', { name: 'My verses' }))
    rendered.unmount()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Practice Psalm 23:1' }))
    expect(screen.getByRole('heading', { name: 'Pair chunks' })).toBeInTheDocument()
  })

  it('imports a file and rejects malformed pasted lists without partial imports', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('link', { name: 'My verses' }))
    fireEvent.click(screen.getByText('Import multiple verses'))
    const file = new File([''], 'verses.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => '[{"reference":"Psalm 23:1","text":"The LORD is my shepherd."}]' })
    fireEvent.change(screen.getByLabelText('Import a file'), { target: { files: [file] } })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Psalm 23:1' })).toBeInTheDocument())
    fireEvent.change(screen.getByRole('textbox', { name: 'Verses to import' }), { target: { value: 'John 3:16 — For God so loved the world.\ninvalid line' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import pasted verses' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Use one verse per line')
    expect(screen.queryByRole('heading', { name: 'John 3:16' })).not.toBeInTheDocument()
  })

  it('provides a read-only weekly view with week navigation and unchanged progress', () => {
    render(<App />)
    startWeekly()
    const saved = localStorage.getItem('verse-memory-v2')
    fireEvent.click(screen.getByRole('link', { name: 'Weekly reading' }))
    const article = screen.getByRole('article', { name: 'Weekly verse reading' })
    expect(within(article).getByText(/Now we exhort you/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cover & recall/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change plan' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
    expect(screen.queryByRole('heading', { name: 'I Thessalonians 5:14-15' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Return to this week' }))
    expect(screen.getByRole('heading', { name: 'I Thessalonians 5:14-15' })).toBeInTheDocument()
    expect(localStorage.getItem('verse-memory-v2')).toBe(saved)
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

  it('grades a typed recall and allows overriding the assigned pile', () => {
    render(<App />)

    fireEvent.change(screen.getByPlaceholderText('Search reference or words…'), { target: { value: 'I Thessalonians 5:14-15' } })
    fireEvent.click(screen.getByRole('button', { name: /I Thessalonians 5:14-15/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Start memorizing →' }))
    fireEvent.click(screen.getByRole('button', { name: /Cover & recall/ }))
    fireEvent.click(screen.getByRole('button', { name: /Type your answer/ }))

    const answer = screen.getByRole('textbox', { name: 'Type from memory' })
    fireEvent.keyDown(answer, { code: 'Space', key: ' ' })
    expect(answer).toBeInTheDocument()
    fireEvent.change(answer, { target: { value: 'now we exhort you brethren warn those who are unruly' } })
    fireEvent.click(screen.getByRole('button', { name: /Check my answer/ }))

    expect(screen.getByRole('heading', { name: 'Got it' })).toBeInTheDocument()
    expect(screen.getByText('Exact words after ignoring punctuation and capitalization.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Hard' }))
    fireEvent.click(screen.getByRole('button', { name: /Continue with Hard/ }))
    expect(screen.getByText('Targeted correction')).toBeInTheDocument()
  })

  it('supports keyboard-only typed recall shortcuts', () => {
    render(<App />)

    fireEvent.change(screen.getByPlaceholderText('Search reference or words…'), { target: { value: 'I Thessalonians 5:14-15' } })
    fireEvent.click(screen.getByRole('button', { name: /I Thessalonians 5:14-15/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Start memorizing →' }))

    fireEvent.keyDown(document, { code: 'Space', key: ' ' })
    expect(screen.getByText('Say it out loud.')).toBeInTheDocument()
    fireEvent.keyDown(document, { code: 'Enter', key: 'Enter' })

    const answer = screen.getByRole('textbox', { name: 'Type from memory' })
    fireEvent.change(answer, { target: { value: 'now we exhort you brethren warn those who are unruly' } })
    fireEvent.keyDown(answer, { code: 'Enter', key: 'Enter', shiftKey: true })
    expect(screen.queryByRole('heading', { name: 'Got it' })).not.toBeInTheDocument()

    fireEvent.keyDown(answer, { code: 'Enter', key: 'Enter' })
    expect(screen.getByRole('heading', { name: 'Got it' })).toBeInTheDocument()

    fireEvent.keyDown(document, { code: 'Digit2', key: '2' })
    expect(screen.getByRole('button', { name: /Continue with Hard/ })).toBeInTheDocument()
    fireEvent.keyDown(document, { code: 'Enter', key: 'Enter' })
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
