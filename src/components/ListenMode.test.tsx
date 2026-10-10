import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ListenMode } from './ListenMode'

class MockUtterance {
  text: string
  lang = ''
  rate = 1
  voice = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(text: string) { this.text = text }
}

describe('Listen mode', () => {
  const spoken: MockUtterance[] = []
  const speech = { speak: vi.fn((utterance: MockUtterance) => spoken.push(utterance)), cancel: vi.fn(), getVoices: vi.fn(() => []) }
  const chunks = ['The LORD is my shepherd;', 'I shall not want.']

  beforeEach(() => {
    localStorage.clear()
    spoken.length = 0
    vi.clearAllMocks()
    vi.stubGlobal('speechSynthesis', speech)
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance)
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  function open(initialPart = 0) {
    return render(<ListenMode chunks={chunks} initialPart={initialPart} onExit={() => {}} />)
  }

  it('requests media playback before speaking and restores the session on end or exit', () => {
    const audioSession = { type: 'auto' }
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { audioSession }))
    const view = open()
    expect(audioSession.type).toBe('auto')
    speech.speak.mockImplementationOnce((utterance) => {
      expect(audioSession.type).toBe('playback')
      return spoken.push(utterance)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Hear this part' }))
    act(() => spoken[0].onend?.())
    expect(audioSession.type).toBe('auto')
    fireEvent.click(screen.getByRole('button', { name: 'Hear this part' }))
    expect(audioSession.type).toBe('playback')
    view.unmount()
    expect(audioSession.type).toBe('auto')
  })

  it('still speaks when the browser rejects the audio session request', () => {
    const audioSession = Object.defineProperty({}, 'type', {
      get: () => 'auto',
      set: () => { throw new Error('Unsupported') },
    })
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { audioSession }))
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Hear this part' }))
    expect(speech.speak).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('speaks only the selected part once per tap, at the selected speed', () => {
    open()
    expect(speech.speak).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Previous part' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Slow' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hear this part' }))
    expect(spoken[0]).toMatchObject({ text: chunks[0], rate: 0.7, lang: 'en-US' })
    act(() => spoken[0].onend?.())
    expect(screen.getByRole('button', { name: 'Hear this part' })).toBeEnabled()
    expect(speech.speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Hear this part' }))
    expect(spoken[1].text).toBe(chunks[0])
    fireEvent.click(screen.getByRole('button', { name: 'Stop playback' }))
    expect(speech.cancel).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Hear this part' })).toBeEnabled()
  })

  it('stops on navigation and ignores late callbacks from the previous part', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Hear this part' }))
    const oldEnd = spoken[0].onend
    const oldError = spoken[0].onerror
    fireEvent.click(screen.getByRole('button', { name: 'Next part' }))
    expect(speech.cancel).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Part 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next part' })).toBeDisabled()
    expect(speech.speak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Hear this part' }))
    expect(spoken[1].text).toBe(chunks[1])
    act(() => { oldEnd?.(); oldError?.() })
    expect(screen.getByRole('button', { name: 'Stop playback' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('restarts at the new speed and remembers it when returning', () => {
    const view = open(1)
    fireEvent.click(screen.getByRole('button', { name: 'Hear this part' }))
    expect(spoken[0].rate).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Slow' }))
    expect(speech.cancel).toHaveBeenCalledTimes(1)
    expect(spoken[1]).toMatchObject({ text: chunks[1], rate: 0.7 })
    view.unmount()
    expect(speech.cancel).toHaveBeenCalledTimes(2)
    open()
    expect(screen.getByRole('button', { name: 'Slow' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('stops playback when leaving the page', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Hear this part' }))
    fireEvent(window, new Event('pagehide'))
    expect(speech.cancel).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Hear this part' })).toBeEnabled()
  })

  it('shows playback errors and lets the user retry', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Hear this part' }))
    act(() => spoken[0].onerror?.())
    expect(screen.getByRole('alert')).toHaveTextContent('Could not play this part')
    fireEvent.click(screen.getByRole('button', { name: 'Hear this part' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(speech.speak).toHaveBeenCalledTimes(2)
  })

  it('explains when browser speech is unavailable', () => {
    vi.stubGlobal('speechSynthesis', undefined)
    open()
    expect(screen.getByRole('button', { name: 'Hear this part' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable in this browser')
  })
})
