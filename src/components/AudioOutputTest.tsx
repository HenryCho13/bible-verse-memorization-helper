import { useEffect, useRef, useState } from 'react'

export function AudioOutputTest() {
  const player = useRef<HTMLAudioElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const audio = player.current
    const stop = () => { if (audio && !audio.paused) audio.pause() }
    window.addEventListener('pagehide', stop)
    return () => {
      window.removeEventListener('pagehide', stop)
      stop()
    }
  }, [])

  return <main className="app-background min-h-screen px-4 py-6 text-ink-900 sm:py-12">
    <section aria-labelledby="audio-test-heading" className="glass-strong mx-auto max-w-xl rounded-3xl border p-6 sm:p-8">
      <a href="/" className="inline-flex min-h-12 items-center rounded-xl px-3 font-bold text-river-600 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-river-500/40">← Back to Verse Memory</a>
      <p className="mt-5 text-xs font-extrabold tracking-[0.18em] text-river-600 uppercase">Speaker & CarPlay check</p>
      <h1 id="audio-test-heading" className="mt-2 font-serif text-3xl font-bold">Audio output test</h1>
      <p className="mt-4 leading-relaxed text-ink-700">Press Play below to hear an eight-second voice clip. Listen for which speaker it comes from.</p>

      <audio
        ref={player}
        aria-label="Speaker test recording"
        aria-describedby="audio-test-transcript"
        controls
        preload="metadata"
        src="/audio/speaker-test.mp3"
        onError={() => setFailed(true)}
        onPlaying={() => setFailed(false)}
        className="my-7 w-full"
      />
      {failed && <p role="alert" className="mb-5 text-sm text-rose-800">The test clip could not load. Reopen this page while online, or try opening the audio file below.</p>}
      <a href="/audio/speaker-test.mp3" className="inline-flex min-h-12 items-center rounded-xl px-3 font-bold text-river-600 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-river-500/40">Open audio file directly</a>

      <ol className="mt-6 list-decimal space-y-3 pl-5 leading-relaxed text-ink-700">
        <li>Disconnect headphones and CarPlay. Play the clip and check for the louder phone speaker.</li>
        <li>With your car parked, connect CarPlay and replay the clip. Check for sound through the car speakers.</li>
      </ol>
      <p className="mt-6 rounded-2xl bg-river-100 p-4 text-sm leading-relaxed">If this clip uses the correct speakers while verse parts use the earpiece, regular audio playback is a promising replacement for the current read-aloud feature. This test does not change verse playback yet.</p>
      <details className="mt-6 text-sm text-ink-700">
        <summary className="cursor-pointer py-3 font-bold">Clip transcript</summary>
        <p id="audio-test-transcript" className="mt-2 leading-relaxed">This is the Verse Memory audio test. This is a regular audio file. Check whether you hear this through your phone speaker, or through your car speakers.</p>
      </details>
    </section>
  </main>
}
