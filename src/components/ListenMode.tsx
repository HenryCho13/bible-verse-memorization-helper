import { useCallback, useEffect, useRef, useState } from 'react'
import { requestPlaybackAudioSession } from '../lib/playbackAudioSession'

const button = 'min-h-18 rounded-2xl px-4 py-4 text-lg font-bold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-river-500/40 disabled:opacity-40'

export function ListenMode({ chunks, initialPart, onExit }: { chunks: string[]; initialPart: number; onExit: () => void }) {
  const [part, setPart] = useState(() => Math.max(0, Math.min(initialPart, chunks.length - 1)))
  const [start, setStart] = useState(part)
  const [end, setEnd] = useState(part)
  const combined = start !== end
  const selection = chunks.slice(start, end + 1).join(' ')
  const playLabel = combined ? 'Hear these parts' : 'Hear this part'
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  // Keep the utterance alive and ignore late events from canceled playback.
  const utterance = useRef<SpeechSynthesisUtterance | null>(null)
  const releaseAudioSession = useRef<(() => void) | null>(null)
  const supported = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function'

  const cancel = useCallback(() => {
    const current = utterance.current
    utterance.current = null
    if (current) {
      current.onend = null
      current.onerror = null
      window.speechSynthesis.cancel()
    }
    releaseAudioSession.current?.()
    releaseAudioSession.current = null
  }, [])

  const stop = useCallback(() => {
    cancel()
    setPlaying(false)
  }, [cancel])

  useEffect(() => {
    window.addEventListener('pagehide', stop)
    return () => {
      window.removeEventListener('pagehide', stop)
      cancel()
    }
  }, [cancel, stop])

  const play = () => {
    if (!supported || !selection) return
    cancel()
    setError('')
    try {
      releaseAudioSession.current = requestPlaybackAudioSession()
      const speech = new SpeechSynthesisUtterance(selection)
      speech.lang = 'en-US'
      speech.rate = 1
      const voices = window.speechSynthesis.getVoices().filter((voice) => /^en(?:[-_]|$)/i.test(voice.lang))
      const voice = voices.find((voice) => voice.default) ?? voices[0]
      if (voice) speech.voice = voice
      speech.onend = () => {
        if (utterance.current !== speech) return
        utterance.current = null
        stop()
      }
      speech.onerror = () => {
        if (utterance.current !== speech) return
        utterance.current = null
        stop()
        setError(`Could not play ${combined ? 'these parts' : 'this part'}. Tap ${playLabel} to try again.`)
      }
      utterance.current = speech
      setPlaying(true)
      window.speechSynthesis.speak(speech)
    } catch {
      stop()
      setError(`Could not play ${combined ? 'these parts' : 'this part'}. Tap ${playLabel} to try again.`)
    }
  }

  const changePart = (next: number) => {
    stop()
    setError('')
    setPart(next)
    setStart(next)
    setEnd(next)
  }

  const extend = (direction: 'previous' | 'next') => {
    stop()
    setError('')
    if (direction === 'previous') setStart((current) => Math.max(0, current - 1))
    else setEnd((current) => Math.min(chunks.length - 1, current + 1))
  }

  return <section aria-labelledby="listen-heading" className="mx-auto max-w-2xl">
    <button onClick={onExit} className={`${button} glass-control mb-4 border text-river-600`}>← Back to practice</button>
    <div className="glass-strong rounded-3xl border p-5 text-center sm:p-8">
      <h2 id="listen-heading" className="font-serif text-3xl font-bold">Listen mode</h2>
      <p className="mt-2 text-sm text-ink-700">Listen once, replay, or add the parts around it.</p>

      <p className="mt-5 text-lg font-bold text-river-600" aria-live="polite">{combined ? `Parts ${start + 1}–${end + 1}` : `Part ${part + 1}`} of {chunks.length}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button disabled={start === 0} onClick={() => changePart(start - 1)} aria-label="Previous part" className={`${button} bg-paper-200 hover:bg-paper-300`}>← Previous</button>
        <button disabled={end === chunks.length - 1} onClick={() => changePart(end + 1)} aria-label="Next part" className={`${button} bg-paper-200 hover:bg-paper-300`}>Next →</button>
      </div>

      <p className="mt-5 max-h-40 min-h-24 overflow-y-auto font-serif text-2xl leading-relaxed font-bold">{selection}</p>

      <button
        onClick={() => playing ? stop() : play()}
        disabled={!supported}
        aria-label={playing ? 'Stop playback' : playLabel}
        className="mx-auto mt-5 flex min-h-28 w-full items-center justify-center gap-4 rounded-3xl bg-river-600 text-xl font-bold text-white shadow-xl shadow-river-600/20 transition hover:bg-river-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-river-500/40 focus-visible:ring-offset-4 disabled:opacity-40"
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" className="h-14 w-14" fill="currentColor">
          {playing ? <rect x="10" y="10" width="28" height="28" rx="4" /> : <path d="M15 7a2 2 0 0 1 3-1.7l25 17a2 2 0 0 1 0 3.4l-25 17A2 2 0 0 1 15 41Z" />}
        </svg>
        {playing ? 'Stop' : playLabel}
      </button>
      <p role="status" className="mt-4 min-h-6 text-sm text-ink-700">{playing ? `Playing ${combined ? 'these parts' : 'this part'} once…` : 'Ready when you are'}</p>
      {!supported && <p role="alert" className="mt-3 text-sm text-rose-800">Read-aloud is unavailable in this browser. Try listen mode in a browser with speech support.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3" role="group" aria-label="Combine parts">
        <button disabled={start === 0} onClick={() => extend('previous')} className={`${button} bg-paper-200 hover:bg-paper-300`}>+ Add previous</button>
        <button disabled={end === chunks.length - 1} onClick={() => extend('next')} className={`${button} bg-paper-200 hover:bg-paper-300`}>+ Add next</button>
      </div>
      {combined && <button onClick={() => changePart(part)} className={`${button} mt-3 w-full border border-paper-300 text-river-600`}>Reset to part {part + 1}</button>}
    </div>
  </section>
}
