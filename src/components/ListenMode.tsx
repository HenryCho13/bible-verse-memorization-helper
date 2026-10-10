import { useCallback, useEffect, useRef, useState } from 'react'

const speedKey = 'verse-memory-listen-speed'
const button = 'min-h-14 rounded-2xl px-4 py-3 font-bold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-river-500/40 disabled:opacity-40'
type Speed = 'slow' | 'normal'

function savedSpeed(): Speed {
  try {
    return localStorage.getItem(speedKey) === 'slow' ? 'slow' : 'normal'
  } catch {
    return 'normal'
  }
}

export function ListenMode({ chunks, initialPart, onExit }: { chunks: string[]; initialPart: number; onExit: () => void }) {
  const [part, setPart] = useState(() => Math.max(0, Math.min(initialPart, chunks.length - 1)))
  const [speed, setSpeed] = useState<Speed>(savedSpeed)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  // Keep the utterance alive and ignore late events from canceled playback.
  const utterance = useRef<SpeechSynthesisUtterance | null>(null)
  const supported = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function'

  const cancel = useCallback(() => {
    const current = utterance.current
    utterance.current = null
    if (current) {
      current.onend = null
      current.onerror = null
      window.speechSynthesis.cancel()
    }
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

  const play = (nextSpeed = speed) => {
    if (!supported || !chunks[part]) return
    cancel()
    setError('')
    try {
      const speech = new SpeechSynthesisUtterance(chunks[part])
      speech.lang = 'en-US'
      speech.rate = nextSpeed === 'slow' ? 0.7 : 1
      const voices = window.speechSynthesis.getVoices().filter((voice) => /^en(?:[-_]|$)/i.test(voice.lang))
      const voice = voices.find((voice) => voice.default) ?? voices[0]
      if (voice) speech.voice = voice
      speech.onend = () => {
        if (utterance.current !== speech) return
        utterance.current = null
        setPlaying(false)
      }
      speech.onerror = () => {
        if (utterance.current !== speech) return
        utterance.current = null
        setPlaying(false)
        setError('Could not play this part. Tap Hear this part to try again.')
      }
      utterance.current = speech
      setPlaying(true)
      window.speechSynthesis.speak(speech)
    } catch {
      stop()
      setError('Could not play this part. Tap Hear this part to try again.')
    }
  }

  const changePart = (next: number) => {
    stop()
    setError('')
    setPart(next)
  }

  const changeSpeed = (next: Speed) => {
    setSpeed(next)
    try { localStorage.setItem(speedKey, next) } catch { /* Playback still works without storage. */ }
    if (playing) play(next)
  }

  return <section aria-labelledby="listen-heading" className="mx-auto max-w-2xl">
    <button onClick={onExit} className={`${button} glass-control mb-4 border text-river-600`}>← Back to practice</button>
    <div className="glass-strong rounded-3xl border p-5 text-center sm:p-8">
      <h2 id="listen-heading" className="font-serif text-3xl font-bold">Listen mode</h2>
      <p className="mt-2 text-sm text-ink-700">One part at a time. Tap to hear it again.</p>

      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <button disabled={part === 0} onClick={() => changePart(part - 1)} aria-label="Previous part" className={`${button} bg-paper-200 hover:bg-paper-300`}>← Previous</button>
        <p className="text-sm font-bold text-river-600" aria-live="polite">Part {part + 1} of {chunks.length}</p>
        <button disabled={part === chunks.length - 1} onClick={() => changePart(part + 1)} aria-label="Next part" className={`${button} bg-paper-200 hover:bg-paper-300`}>Next →</button>
      </div>

      <p className="mt-6 flex min-h-24 items-center justify-center font-serif text-xl leading-relaxed font-bold sm:text-2xl">{chunks[part]}</p>

      <button
        onClick={() => playing ? stop() : play()}
        disabled={!supported}
        aria-label={playing ? 'Stop playback' : 'Hear this part'}
        className="mx-auto mt-6 flex h-48 w-48 flex-col items-center justify-center gap-4 rounded-full bg-river-600 text-xl font-bold text-white shadow-xl shadow-river-600/20 transition hover:bg-river-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-river-500/40 focus-visible:ring-offset-4 disabled:opacity-40 sm:h-56 sm:w-56"
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" className="h-14 w-14" fill="currentColor">
          {playing ? <rect x="10" y="10" width="28" height="28" rx="4" /> : <path d="M15 7a2 2 0 0 1 3-1.7l25 17a2 2 0 0 1 0 3.4l-25 17A2 2 0 0 1 15 41Z" />}
        </svg>
        {playing ? 'Stop' : 'Hear this part'}
      </button>
      <p role="status" className="mt-4 min-h-6 text-sm text-ink-700">{playing ? 'Playing this part once…' : 'Ready when you are'}</p>
      {!supported && <p role="alert" className="mt-3 text-sm text-rose-800">Read-aloud is unavailable in this browser. Try listen mode in a browser with speech support.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p>}

      <fieldset className="mx-auto mt-6 max-w-sm">
        <legend className="mb-2 w-full text-sm font-bold text-ink-700">Playback speed</legend>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-paper-200 p-1">
          {(['slow', 'normal'] as const).map((value) => <button key={value} aria-pressed={speed === value} onClick={() => changeSpeed(value)} className={`${button} ${speed === value ? 'bg-white text-river-600 shadow-sm' : 'text-ink-700 hover:bg-white/60'}`}>{value === 'slow' ? 'Slow' : 'Normal'}</button>)}
        </div>
      </fieldset>
    </div>
  </section>
}
