import { useEffect, useMemo, useRef, useState } from 'react'
import rawVerses from '../english_bible_verses_from_har.txt?raw'
import { parseVerses } from './data/parseVerses'
import { autoChunkBoundaries, chunksFromBoundaries, toggleBoundary, wordsOf } from './lib/chunks'
import { clearRepair, createSession, rateCurrent, STAGES } from './lib/practice'
import { addWeeks, formatWeekRange, getWeekKey, nextBoundary, verseForWeek } from './lib/schedule'
import { emptyStore, loadStore, saveStore } from './lib/storage'
import type { AppStore, PracticeSession, Rating, Verse } from './types'

let catalog: Verse[] = []
let catalogError = ''
try {
  catalog = parseVerses(rawVerses)
} catch (error) {
  catalogError = error instanceof Error ? error.message : 'Unknown catalog error.'
}

const buttonBase = 'rounded-xl px-4 py-3 font-bold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-river-500/30 disabled:opacity-40'

function App() {
  const [store, setStore] = useState<AppStore>(() => loadStore())
  const [currentWeek, setCurrentWeek] = useState(() => getWeekKey())
  const [viewedWeek, setViewedWeek] = useState(() => getWeekKey())
  const previousCurrent = useRef(currentWeek)

  useEffect(() => saveStore(store), [store])

  useEffect(() => {
    const refresh = () => setCurrentWeek(getWeekKey())
    const interval = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  useEffect(() => {
    if (viewedWeek === previousCurrent.current) setViewedWeek(currentWeek)
    previousCurrent.current = currentWeek
  }, [currentWeek, viewedWeek])

  if (catalogError) return <CatalogError message={catalogError} />
  if (!store.plan) {
    return <VerseSelection verses={catalog} onSelect={(verse) => {
      const weekKey = getWeekKey()
      setStore((current) => ({ ...current, plan: { anchorWeekKey: weekKey, anchorVerseId: verse.id } }))
      setViewedWeek(weekKey)
    }} />
  }

  const verse = verseForWeek(store.plan, viewedWeek, catalog)
  const session = store.sessions[viewedWeek]?.verseId === verse.id ? store.sessions[viewedWeek] : undefined
  const isCurrent = viewedWeek === currentWeek

  const updateSession = (next: PracticeSession) => {
    setStore((current) => ({ ...current, sessions: { ...current.sessions, [viewedWeek]: next } }))
  }

  const startSession = (boundaries: number[]) => {
    const next = createSession(viewedWeek, verse.id, verse.text, boundaries)
    setStore((current) => ({
      ...current,
      chunkPreferences: { ...current.chunkPreferences, [verse.id]: boundaries },
      sessions: { ...current.sessions, [viewedWeek]: next },
    }))
  }

  const restartSession = () => {
    if (!session || !window.confirm(`Restart your practice for ${verse.reference}?`)) return
    updateSession(createSession(viewedWeek, verse.id, verse.text, session.boundaries))
  }

  const resetPlan = () => {
    if (!window.confirm('Choose a new starting verse? This clears weekly session progress but keeps your saved chunk preferences.')) return
    setStore({ ...emptyStore(), chunkPreferences: store.chunkPreferences })
  }

  return (
    <div className="app-background min-h-screen text-ink-900">
      <header className="glass-header sticky top-0 z-20 border-b">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-5 sm:py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold tracking-[0.18em] text-river-600 uppercase">Verse Memory</span>
              {!isCurrent && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Viewing another week</span>}
            </div>
            <h1 className="font-serif text-3xl leading-tight font-bold sm:text-5xl">{verse.reference}</h1>
            <p className="mt-2 text-sm font-semibold text-ink-700">{verse.topic} · Week of {formatWeekRange(viewedWeek)}</p>
          </div>
          <WeekNavigator
            currentWeek={currentWeek}
            viewedWeek={viewedWeek}
            onChange={setViewedWeek}
            onResetPlan={resetPlan}
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-10">
        {!isCurrent && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span><strong>{verse.reference}</strong> belongs to {formatWeekRange(viewedWeek)}. Practice here is saved separately.</span>
            <button className={`${buttonBase} glass-control px-3 py-2 text-amber-950 hover:bg-white/80`} onClick={() => setViewedWeek(currentWeek)}>Return to this week</button>
          </div>
        )}
        {session ? (
          <PracticeWorkspace session={session} verse={verse} onUpdate={updateSession} onRestart={restartSession} />
        ) : (
          <ChunkSetup
            key={`${viewedWeek}-${verse.id}`}
            verse={verse}
            initialBoundaries={store.chunkPreferences[verse.id] ?? autoChunkBoundaries(verse.text)}
            onStart={startSession}
          />
        )}
      </main>
    </div>
  )
}

function CatalogError({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-paper-100 p-6">
      <section className="max-w-xl rounded-2xl border border-red-200 bg-white p-8 paper-shadow">
        <p className="text-xs font-extrabold tracking-widest text-red-700 uppercase">Verse data error</p>
        <h1 className="mt-2 font-serif text-3xl font-bold">The verse catalog could not be loaded.</h1>
        <p className="mt-4 text-ink-700">{message}</p>
      </section>
    </main>
  )
}

function VerseSelection({ verses, onSelect }: { verses: Verse[]; onSelect: (verse: Verse) => void }) {
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState('All topics')
  const topics = useMemo(() => ['All topics', ...new Set(verses.map((verse) => verse.topic))], [verses])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return verses.filter((verse) => (topic === 'All topics' || verse.topic === topic)
      && (!query || `${verse.reference} ${verse.text}`.toLowerCase().includes(query)))
  }, [verses, search, topic])

  return (
    <main className="app-background min-h-screen soft-grid">
      <section className="mx-auto max-w-6xl px-4 py-9 sm:px-5 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-xs font-extrabold tracking-[0.2em] text-river-600 uppercase">Set your weekly path</p>
          <h1 className="mt-3 font-serif text-4xl leading-[1.02] font-bold sm:text-7xl sm:leading-[0.98]">Choose this week’s verse.</h1>
          <p className="mt-5 max-w-2xl leading-relaxed text-ink-700 sm:mt-6 sm:text-lg">This choice becomes your weekly anchor. The app advances to the next verse every Sunday at 3:00 PM in your local time.</p>
        </div>

        <div className="glass-panel mt-8 grid gap-3 rounded-2xl border p-3 sm:mt-10 sm:grid-cols-[1fr_220px] sm:p-4">
          <label>
            <span className="sr-only">Search verses</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference or words…" className="glass-control w-full rounded-xl border px-4 py-3 outline-none focus:border-river-500 focus:ring-3 focus:ring-river-500/15" />
          </label>
          <label>
            <span className="sr-only">Filter by topic</span>
            <select value={topic} onChange={(event) => setTopic(event.target.value)} className="glass-control w-full rounded-xl border px-4 py-3 outline-none focus:border-river-500">
              {topics.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>

        <p className="mt-5 text-sm font-bold text-ink-700">{filtered.length} {filtered.length === 1 ? 'verse' : 'verses'}</p>
        <div className="mt-3 grid gap-3 sm:max-h-[60vh] sm:grid-cols-2 sm:overflow-y-auto sm:pr-1">
          {filtered.map((verse) => (
            <button key={verse.id} onClick={() => onSelect(verse)} className="glass-panel group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-river-500 hover:bg-white/75 hover:shadow-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-river-500/30 sm:p-5">
              <span className="text-xs font-extrabold tracking-wider text-river-600 uppercase">{verse.topic} · #{verse.id}</span>
              <strong className="mt-2 block font-serif text-xl group-hover:text-river-600">{verse.reference}</strong>
              <span className="mt-2 line-clamp-3 block text-sm leading-relaxed text-ink-700">{verse.text}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

function WeekNavigator({ currentWeek, viewedWeek, onChange, onResetPlan }: { currentWeek: string; viewedWeek: string; onChange: (key: string) => void; onResetPlan: () => void }) {
  const options = Array.from({ length: 25 }, (_, index) => addWeeks(currentWeek, index - 12))
  const rollover = nextBoundary().toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })
  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
        <button aria-label="Previous week" className={`${buttonBase} glass-control min-h-12 shrink-0 border px-4 hover:bg-white/80`} onClick={() => onChange(addWeeks(viewedWeek, -1))}>←</button>
        <select aria-label="Choose week" value={options.includes(viewedWeek) ? viewedWeek : ''} onChange={(event) => onChange(event.target.value)} className="glass-control min-w-0 flex-1 rounded-xl border px-3 py-3 font-bold outline-none focus:border-river-500 sm:min-w-48">
          {!options.includes(viewedWeek) && <option value={viewedWeek}>{formatWeekRange(viewedWeek)}</option>}
          {options.map((key) => <option key={key} value={key}>{key === currentWeek ? 'This week · ' : ''}{formatWeekRange(key)}</option>)}
        </select>
        <button aria-label="Next week" className={`${buttonBase} glass-control min-h-12 shrink-0 border px-4 hover:bg-white/80`} onClick={() => onChange(addWeeks(viewedWeek, 1))}>→</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-xs text-ink-700 sm:justify-end">
        <span>Next verse: {rollover}</span>
        <button className="font-bold underline decoration-paper-300 underline-offset-4 hover:text-river-600" onClick={onResetPlan}>Change plan</button>
      </div>
    </div>
  )
}

function ChunkSetup({ verse, initialBoundaries, onStart }: { verse: Verse; initialBoundaries: number[]; onStart: (boundaries: number[]) => void }) {
  const suggested = useMemo(() => autoChunkBoundaries(verse.text), [verse.text])
  const [boundaries, setBoundaries] = useState(initialBoundaries)
  const words = wordsOf(verse.text)
  const chunks = chunksFromBoundaries(verse.text, boundaries)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="glass-panel rounded-2xl border p-4 sm:rounded-3xl sm:p-9">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-extrabold tracking-[0.18em] text-river-600 uppercase">Prepare your chunks</p>
            <h2 className="mt-2 font-serif text-3xl font-bold">Mark natural stopping points</h2>
          </div>
          <button onClick={() => setBoundaries(suggested)} className={`${buttonBase} bg-paper-200 px-3 py-2 text-sm hover:bg-paper-300`}>Reset suggestion</button>
        </div>
        <p className="mt-4 max-w-3xl leading-relaxed text-ink-700">Tap a gap to add or remove a break. The words never change—only the places where you pause and retrieve.</p>

        <div className="glass-strong mt-6 rounded-2xl border p-4 font-serif text-lg leading-[2.35] sm:mt-8 sm:p-7 sm:text-2xl sm:leading-[2.2]">
          {words.map((word, index) => (
            <span key={`${word}-${index}`}>
              {word}
              {index < words.length - 1 && (
                <button
                  type="button"
                  aria-label={`${boundaries.includes(index + 1) ? 'Remove' : 'Add'} break after ${word}`}
                  onClick={() => setBoundaries((current) => toggleBoundary(current, index + 1))}
                  className={`mx-1 inline-flex h-9 w-4 translate-y-2 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-river-500 sm:h-8 sm:w-3 ${boundaries.includes(index + 1) ? 'bg-river-500 hover:bg-river-600' : 'bg-paper-200 hover:bg-paper-300'}`}
                >
                  <span className="sr-only">Toggle chunk break</span>
                </button>
              )}
            </span>
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-4 border-t border-paper-300 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-700"><strong>{chunks.length} chunks</strong> · Two clean recalls required for each practice unit</p>
          <button onClick={() => onStart(boundaries)} className={`${buttonBase} w-full bg-river-600 text-white shadow-lg shadow-river-600/15 hover:bg-river-500 sm:w-auto`}>Start memorizing →</button>
        </div>
      </section>

      <aside className="glass-panel rounded-2xl border p-5 sm:rounded-3xl sm:p-6">
        <p className="text-xs font-extrabold tracking-[0.18em] text-leaf-600 uppercase">Chunk preview</p>
        <ol className="mt-5 space-y-3">
          {chunks.map((chunk, index) => (
            <li key={`${chunk}-${index}`} className="flex gap-3 rounded-xl bg-paper-100 p-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-extrabold text-river-600">{index + 1}</span>
              <span className="font-serif leading-snug">{chunk}</span>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}

function PracticeWorkspace({ session, verse, onUpdate, onRestart }: { session: PracticeSession; verse: Verse; onUpdate: (session: PracticeSession) => void; onRestart: () => void }) {
  const chunks = chunksFromBoundaries(verse.text, session.boundaries)
  const unit = session.queue[0] ? session.units[session.queue[0]] : undefined
  const gotIt = session.attempts.filter((attempt) => attempt.rating === 'got-it').length
  const mastered = Object.values(session.progress).filter((progress) => progress.mastered).length

  if (session.completedAt) {
    return (
      <section className="glass-panel mx-auto max-w-3xl rounded-2xl border p-6 text-center sm:rounded-3xl sm:p-14">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-leaf-500 text-3xl text-white">✓</div>
        <p className="mt-7 text-xs font-extrabold tracking-[0.2em] text-leaf-600 uppercase">Session complete</p>
        <h2 className="mt-3 font-serif text-4xl font-bold sm:text-5xl">You recalled {verse.reference}.</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-700">You built the verse from small chunks, trained its transitions, varied your starting points, and completed two clean full recitations.</p>
        <div className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-2 sm:gap-3">
          <Stat value={session.attempts.length} label="Attempts" />
          <Stat value={gotIt} label="Got it" />
          <Stat value={chunks.length} label="Chunks" />
        </div>
        <button onClick={onRestart} className={`${buttonBase} mt-9 bg-paper-200 hover:bg-paper-300`}>Practice again</button>
      </section>
    )
  }

  if (!unit) return null
  const stage = STAGES[session.stageIndex]

  const commitRating = (rating: Rating, troubleChunk?: number) => {
    onUpdate(rateCurrent(session, chunks, rating, troubleChunk))
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="order-2 lg:order-1">
        <div className="glass-panel rounded-2xl border p-4 sm:rounded-3xl sm:p-5 lg:sticky lg:top-28">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold tracking-[0.16em] text-river-600 uppercase">Learning path</p>
            <button onClick={onRestart} className="text-xs font-bold text-ink-700 underline decoration-paper-300 underline-offset-4 hover:text-river-600">Restart</button>
          </div>
          <ol className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:block sm:space-y-2">
            {STAGES.map((item, index) => {
              const active = index === session.stageIndex
              const done = index < session.stageIndex
              return (
                <li key={item.id} className={`flex min-w-0 items-center gap-2 rounded-xl p-2.5 sm:gap-3 sm:p-3 ${active ? 'bg-river-600 text-white' : 'text-ink-700'}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ${active ? 'bg-white text-river-600' : done ? 'bg-leaf-500 text-white' : 'bg-paper-200'}`}>{done ? '✓' : index + 1}</span>
                  <span className="text-sm font-bold leading-tight">{item.name}</span>
                </li>
              )
            })}
          </ol>
          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-paper-300 pt-5">
            <Stat value={session.attempts.length} label="Tries" compact />
            <Stat value={gotIt} label="Clean" compact />
            <Stat value={mastered} label="Ready" compact />
          </div>
        </div>
      </aside>

      <section className="order-1 lg:order-2">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold tracking-[0.18em] text-river-600 uppercase">Stage {session.stageIndex + 1} of {STAGES.length}</p>
            <h2 className="mt-1 font-serif text-3xl font-bold">{stage.name}</h2>
            <p className="mt-1 text-sm text-ink-700">{stage.description}</p>
          </div>
          <p className="text-sm font-bold text-ink-700">{session.queue.length} in queue</p>
        </div>

        {session.repair ? (
          <RepairCard session={session} onContinue={() => onUpdate(clearRepair(session))} />
        ) : (
          <RecallCard
            key={`${unit.id}-${session.progress[unit.id]?.attempts ?? 0}`}
            unit={unit}
            chunks={chunks}
            progress={session.progress[unit.id]}
            onRate={commitRating}
          />
        )}
      </section>
    </div>
  )
}

function RecallCard({ unit, chunks, progress, onRate }: { unit: PracticeSession['units'][string]; chunks: string[]; progress: PracticeSession['progress'][string]; onRate: (rating: Rating, troubleChunk?: number) => void }) {
  const [phase, setPhase] = useState<'study' | 'recall' | 'check'>('study')
  const [pendingRating, setPendingRating] = useState<'again' | 'hard'>()

  const rate = (rating: Rating) => {
    if (rating !== 'got-it' && unit.chunkIndexes.length > 1) setPendingRating(rating)
    else onRate(rating, rating === 'got-it' ? undefined : unit.chunkIndexes[0])
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || pendingRating) return
      if (event.code === 'Space') {
        event.preventDefault()
        if (phase === 'study') setPhase('recall')
        else if (phase === 'recall') setPhase('check')
      }
      if (phase === 'check' && event.key === '1') rate('again')
      if (phase === 'check' && event.key === '2') rate('hard')
      if (phase === 'check' && event.key === '3') rate('got-it')
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  })

  return (
    <div className="glass-panel overflow-hidden rounded-2xl border sm:rounded-3xl">
      <div className="flex items-center justify-between gap-3 border-b border-paper-300 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-extrabold tracking-[0.16em] text-ink-700 uppercase">{unit.checkpoint ? 'Interleaved checkpoint' : unit.label}</p>
          <p className="mt-1 text-xs text-ink-700">Clean recalls: {progress.streak}/{unit.requiredStreak}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${phase === 'study' ? 'bg-river-100 text-river-600' : phase === 'recall' ? 'bg-amber-100 text-amber-800' : 'bg-leaf-100 text-leaf-600'}`}>{phase === 'study' ? 'Study' : phase === 'recall' ? 'Covered' : 'Check'}</span>
      </div>

      <div className={`grid min-h-[280px] place-items-center p-5 text-center sm:min-h-[340px] sm:p-12 ${phase === 'recall' ? 'bg-ink-900/92 text-white backdrop-blur-2xl' : 'glass-strong'}`}>
        {phase === 'recall' ? (
          <div>
            <p className="text-xs font-extrabold tracking-[0.2em] text-paper-300 uppercase">No peeking</p>
            <h3 className="mt-4 font-serif text-4xl font-bold">Say it out loud.</h3>
            <p className="mt-4 text-paper-300">Retrieve the words, then reveal the text to check yourself.</p>
          </div>
        ) : (
          <div>
            <p className="font-serif text-2xl leading-snug font-bold sm:text-4xl">{unit.text}</p>
            {phase === 'check' && unit.chunkIndexes.length > 1 && (
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {unit.chunkIndexes.map((index) => <span key={index} className="rounded-lg bg-paper-100 px-3 py-2 text-left font-serif text-sm"><b className="mr-2 font-sans text-xs text-river-600">{index + 1}</b>{chunks[index]}</span>)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-paper-300 p-4 sm:p-6">
        {pendingRating ? (
          <div>
            <p className="text-center font-bold">Where did you lose your place?</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {unit.chunkIndexes.map((index) => (
                <button key={index} onClick={() => onRate(pendingRating, index)} className={`${buttonBase} bg-paper-200 px-3 py-2 text-sm hover:bg-paper-300`}>Chunk {index + 1}</button>
              ))}
              <button onClick={() => setPendingRating(undefined)} className={`${buttonBase} px-3 py-2 text-sm text-ink-700 hover:bg-paper-100`}>Cancel</button>
            </div>
          </div>
        ) : phase === 'study' ? (
          <button onClick={() => setPhase('recall')} className={`${buttonBase} w-full bg-river-600 text-white hover:bg-river-500`}>Cover & recall <span className="ml-2 hidden text-white/60 sm:inline">Space</span></button>
        ) : phase === 'recall' ? (
          <button onClick={() => setPhase('check')} className={`${buttonBase} w-full bg-white text-ink-900 ring-1 ring-paper-300 hover:bg-paper-100`}>Reveal & check <span className="ml-2 hidden text-ink-700/60 sm:inline">Space</span></button>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            <button onClick={() => rate('again')} className={`${buttonBase} bg-rose-100 text-rose-800 hover:bg-rose-200`}>Again <span className="ml-1 hidden opacity-50 sm:inline">1</span></button>
            <button onClick={() => rate('hard')} className={`${buttonBase} bg-amber-100 text-amber-900 hover:bg-amber-200`}>Hard <span className="ml-1 hidden opacity-50 sm:inline">2</span></button>
            <button onClick={() => rate('got-it')} className={`${buttonBase} bg-leaf-600 text-white hover:bg-leaf-500`}>Got it <span className="ml-1 hidden opacity-60 sm:inline">3</span></button>
          </div>
        )}
      </div>
    </div>
  )
}

function RepairCard({ session, onContinue }: { session: PracticeSession; onContinue: () => void }) {
  const repair = session.repair!
  return (
    <div className="glass-panel rounded-2xl border border-amber-200/60 p-5 sm:rounded-3xl sm:p-10">
      <p className="text-xs font-extrabold tracking-[0.18em] text-amber-800 uppercase">Targeted correction</p>
      <h3 className="mt-2 font-serif text-3xl font-bold">{repair.label}</h3>
      <p className="mt-3 text-ink-700">Review only the nearby connection. You do not need to restart from the beginning.</p>
      <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-5 text-center font-serif text-xl leading-relaxed sm:mt-7 sm:p-7 sm:text-2xl">{repair.text}</div>
      <button onClick={onContinue} className={`${buttonBase} mt-6 w-full bg-amber-800 text-white hover:bg-amber-700`}>Continue the queue →</button>
    </div>
  )
}

function Stat({ value, label, compact = false }: { value: number; label: string; compact?: boolean }) {
  return (
    <div className={`rounded-xl bg-paper-100 text-center ${compact ? 'p-2' : 'p-4'}`}>
      <strong className={`block font-serif ${compact ? 'text-xl' : 'text-3xl'}`}>{value}</strong>
      <span className="text-[10px] font-extrabold tracking-wider text-ink-700 uppercase">{label}</span>
    </div>
  )
}

export default App
