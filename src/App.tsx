import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import rawVerses from '../english_bible_verses_from_har.txt?raw'
import { parseVerses } from './data/parseVerses'
import { autoChunkBoundaries, chunksFromBoundaries, toggleBoundary, wordsOf } from './lib/chunks'
import { clearRepair, createSession, rateCurrent, skipToStage, STAGES } from './lib/practice'
import { gradeTypedRecall, normalizeRecallText } from './lib/recallGrading'
import { addWeeks, formatWeekRange, getWeekKey, nextBoundary, verseForWeek } from './lib/schedule'
import { loadStore, saveStore } from './lib/storage'
import type { AppStore, PracticeSession, Rating, Verse } from './types'
import { PersonalLibrary } from './components/PersonalLibrary'
import { mergePersonalVerses } from './data/importVerses'
import type { TypedRecallGrade } from './lib/recallGrading'

let catalog: Verse[] = []
let catalogError = ''
try {
  catalog = parseVerses(rawVerses)
} catch (error) {
  catalogError = error instanceof Error ? error.message : 'Unknown catalog error.'
}

const buttonBase = 'rounded-xl px-4 py-3 font-bold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-river-500/30 disabled:opacity-40'
const EVENT_PATH = '/event/2026-ec-yao-retreat-2'
const EVENT_SESSION_KEY = 'event:2026-ec-yao-retreat-2'
const eventVerse: Verse = {
  id: 10001,
  topic: 'One-time memorization',
  reference: 'Joel 2:28-32',
  text: 'And it shall come to pass afterward That I will pour out My Spirit on all flesh; Your sons and your daughters shall prophesy, Your old men shall dream dreams, Your young men shall see visions. And also on My menservants and on My maidservants I will pour out My Spirit in those days. And I will show wonders in the heavens and in the earth: Blood and fire and pillars of smoke. The sun shall be turned into darkness, And the moon into blood, Before the coming of the great and awesome day of the LORD. And it shall come to pass That whoever calls on the name of the LORD Shall be saved. For in Mount Zion and in Jerusalem there shall be deliverance, As the LORD has said, Among the remnant whom the LORD calls.',
}

type AppTab = 'practice' | 'personal' | 'reading'
const tabs: { id: AppTab; label: string }[] = [
  { id: 'practice', label: 'Weekly practice' },
  { id: 'personal', label: 'My verses' },
  { id: 'reading', label: 'Weekly reading' },
]
function currentTab(): AppTab {
  return tabs.find((tab) => window.location.hash === `#${tab.id}`)?.id ?? 'practice'
}

function App() {
  const [store, setStore] = useState<AppStore>(() => loadStore())
  const [tab, setTab] = useState<AppTab>(currentTab)
  const [personalId, setPersonalId] = useState<number>()
  useEffect(() => saveStore(store), [store])
  useEffect(() => {
    const update = () => setTab(currentTab())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const navigate = (next: AppTab) => { window.location.hash = next; setTab(next) }
  if (window.location.pathname === EVENT_PATH) {
    return <SavedMemorization store={store} setStore={setStore} verse={eventVerse} sessionKey={EVENT_SESSION_KEY} title="2026 EC YAO Retreat 2" />
  }
  const personalVerse = store.personalVerses.find((verse) => verse.id === personalId)
  return <div className="app-background min-h-screen text-ink-900">
    <nav aria-label="Main navigation" className="glass-header border-b px-3 py-3 sm:px-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="px-1 text-xs font-extrabold tracking-[0.18em] text-river-600 uppercase">Verse Memory</span>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-paper-200/60 p-1">
          {tabs.map((item) => <a key={item.id} href={`#${item.id}`} aria-current={tab === item.id ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate(item.id) }} className={`flex min-h-12 items-center justify-center rounded-xl px-3 py-2 text-center text-sm font-bold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-river-500/30 ${tab === item.id ? 'bg-white text-river-600 shadow-sm' : 'text-ink-700 hover:bg-white/60'}`}>{item.label}</a>)}
        </div>
      </div>
    </nav>
    {tab !== 'personal' ? (
      <WeeklyMemorization store={store} setStore={setStore} reading={tab === 'reading'} onChoosePlan={() => navigate('practice')} />
    ) : personalVerse ? (
      <SavedMemorization
        key={personalVerse.id}
        store={store}
        setStore={setStore}
        verse={personalVerse}
        sessionKey={`personal:${personalVerse.id}`}
        title="My verses"
        onBack={() => setPersonalId(undefined)}
      />
    ) : (
      <PersonalLibrary
        verses={store.personalVerses}
        onPractice={(verse) => setPersonalId(verse.id)}
        onImport={(imported) => {
          const merged = mergePersonalVerses(store.personalVerses, imported)
          const count = merged.length - store.personalVerses.length
          setStore((current) => ({ ...current, personalVerses: mergePersonalVerses(current.personalVerses, imported) }))
          return count
        }}
      />
    )}
  </div>
}

function WeeklyMemorization({ store, setStore, reading, onChoosePlan }: { store: AppStore; setStore: Dispatch<SetStateAction<AppStore>>; reading: boolean; onChoosePlan: () => void }) {
  const [currentWeek, setCurrentWeek] = useState(() => getWeekKey())
  const [viewedWeek, setViewedWeek] = useState(() => getWeekKey())
  const previousCurrent = useRef(currentWeek)

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
  if (!store.plan && reading) return <main className="mx-auto max-w-2xl px-4 py-10">
    <h1 className="font-serif text-3xl font-bold">Weekly reading</h1>
    <p className="mt-4 leading-relaxed text-ink-700">Choose your starting weekly verse to read this week’s passage and browse past or upcoming weeks.</p>
    <button onClick={onChoosePlan} className={`${buttonBase} mt-6 bg-river-600 text-white`}>Choose a weekly verse</button>
  </main>
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
    setStore((current) => ({ ...current, plan: undefined, sessions: Object.fromEntries(Object.entries(current.sessions).filter(([key]) => key.startsWith('personal:') || key.startsWith('event:'))) }))
  }

  return (
    <div className="app-background min-h-screen text-ink-900">
      <header className={`glass-header top-0 z-20 border-b ${reading ? 'sm:sticky' : 'sticky'}`}>
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
            onResetPlan={reading ? undefined : resetPlan}
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-10">
        {!isCurrent && !reading && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span><strong>{verse.reference}</strong> belongs to {formatWeekRange(viewedWeek)}. Practice here is saved separately.</span>
            <button className={`${buttonBase} glass-control px-3 py-2 text-amber-950 hover:bg-white/80`} onClick={() => setViewedWeek(currentWeek)}>Return to this week</button>
          </div>
        )}
        {reading ? (
          <article aria-label="Weekly verse reading" className="glass-strong mx-auto max-w-3xl rounded-2xl border p-5 sm:rounded-3xl sm:p-10">
            <p className="text-xs font-extrabold tracking-[0.18em] text-river-600 uppercase">Weekly reading</p>
            <p className="mt-6 whitespace-pre-line font-serif text-xl leading-[1.85] sm:text-2xl sm:leading-[1.9]">{verse.text}</p>
            <p className="mt-8 font-bold text-ink-700">{verse.reference}</p>
            {!isCurrent && <button onClick={() => setViewedWeek(currentWeek)} className={`${buttonBase} mt-6 w-full bg-paper-200 hover:bg-paper-300`}>Return to this week</button>}
          </article>
        ) : session ? (
          <PracticeWorkspace key={`${viewedWeek}-${verse.id}`} session={session} verse={verse} onUpdate={updateSession} onRestart={restartSession} />
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

function SavedMemorization({ store, setStore, verse, sessionKey, title, onBack }: { store: AppStore; setStore: Dispatch<SetStateAction<AppStore>>; verse: Verse; sessionKey: string; title: string; onBack?: () => void }) {
  const session = store.sessions[sessionKey]?.verseId === verse.id ? store.sessions[sessionKey] : undefined

  const updateSession = (next: PracticeSession) => {
    setStore((current) => ({ ...current, sessions: { ...current.sessions, [sessionKey]: next } }))
  }

  const startSession = (boundaries: number[]) => {
    const next = createSession(sessionKey, verse.id, verse.text, boundaries)
    setStore((current) => ({
      ...current,
      chunkPreferences: { ...current.chunkPreferences, [verse.id]: boundaries },
      sessions: { ...current.sessions, [sessionKey]: next },
    }))
  }

  const restartSession = () => {
    if (!session || !window.confirm(`Restart your practice for ${verse.reference}?`)) return
    updateSession(createSession(sessionKey, verse.id, verse.text, session.boundaries))
  }

  return (
    <div className="app-background min-h-screen text-ink-900">
      <header className="glass-header sticky top-0 z-20 border-b">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-6 lg:px-8">
          {onBack && <button onClick={onBack} className={`${buttonBase} mb-4 bg-paper-200 hover:bg-paper-300`}>← My verses</button>}
          <p className="text-xs font-extrabold tracking-[0.18em] text-river-600 uppercase">{onBack ? 'Personal memorization' : 'One-time memorization'}</p>
          <h1 className="mt-2 font-serif text-3xl leading-tight font-bold sm:text-5xl">{verse.reference}</h1>
          <p className="mt-2 text-sm font-semibold text-ink-700">{title}</p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-10">
        {session ? (
          <PracticeWorkspace session={session} verse={verse} onUpdate={updateSession} onRestart={restartSession} />
        ) : (
          <ChunkSetup
            key={sessionKey}
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

function WeekNavigator({ currentWeek, viewedWeek, onChange, onResetPlan }: { currentWeek: string; viewedWeek: string; onChange: (key: string) => void; onResetPlan?: () => void }) {
  const options = Array.from({ length: 25 }, (_, index) => addWeeks(currentWeek, index - 12))
  const rollover = nextBoundary().toLocaleString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' })
  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
        <button aria-label="Previous week" className={`${buttonBase} glass-control min-h-12 shrink-0 border px-4 hover:bg-white/80`} onClick={() => onChange(addWeeks(viewedWeek, -1))}>←</button>
        <select aria-label="Choose week" value={viewedWeek} onChange={(event) => onChange(event.target.value)} className="glass-control min-w-0 flex-1 rounded-xl border px-3 py-3 font-bold outline-none focus:border-river-500 sm:min-w-48">
          {!options.includes(viewedWeek) && <option value={viewedWeek}>{formatWeekRange(viewedWeek)}</option>}
          {options.map((key) => <option key={key} value={key}>{key === currentWeek ? 'This week · ' : ''}{formatWeekRange(key)}</option>)}
        </select>
        <button aria-label="Next week" className={`${buttonBase} glass-control min-h-12 shrink-0 border px-4 hover:bg-white/80`} onClick={() => onChange(addWeeks(viewedWeek, 1))}>→</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-xs text-ink-700 sm:justify-end">
        <span>Next verse: {rollover}</span>
        {onResetPlan && <button className="min-h-11 font-bold underline decoration-paper-300 underline-offset-4 hover:text-river-600" onClick={onResetPlan}>Change plan</button>}
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
  const [showFullVerse, setShowFullVerse] = useState(false)
  const chunks = chunksFromBoundaries(verse.text, session.boundaries)
  const canSkip = !session.completedAt && session.stageIndex < STAGES.length - 1
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target
      if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || (target instanceof HTMLElement && (target.closest('input, textarea, select, [contenteditable="true"]')))) return
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        setShowFullVerse((current) => !current)
      }
      if (event.key.toLowerCase() === 's' && canSkip) {
        event.preventDefault()
        onUpdate(skipToStage(session, chunks, event.shiftKey ? STAGES.length - 1 : session.stageIndex + 1))
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  })
  const fullVerse = <div className="mb-5">
    <button onClick={() => setShowFullVerse((current) => !current)} aria-expanded={showFullVerse} aria-controls="full-verse-reference" aria-keyshortcuts="f" className={`${buttonBase} glass-control w-full border text-river-600 sm:w-auto`}>{showFullVerse ? 'Hide full verse' : 'Show full verse'} <kbd aria-hidden="true" className="ml-2 rounded bg-paper-200 px-2 py-0.5 text-xs">F</kbd></button>
    {showFullVerse && <section id="full-verse-reference" aria-label="Full verse reference" className="glass-strong mt-3 rounded-2xl border p-5 sm:p-7">
      <h3 className="font-bold text-river-600">{verse.reference}</h3>
      <p className="mt-3 whitespace-pre-line font-serif text-lg leading-relaxed sm:text-xl">{verse.text}</p>
    </section>}
  </div>
  const unit = session.queue[0] ? session.units[session.queue[0]] : undefined
  const gotIt = session.attempts.filter((attempt) => attempt.rating === 'got-it').length
  const mastered = Object.values(session.progress).filter((progress) => progress.mastered).length

  if (session.completedAt) {
    return (
      <div>{fullVerse}<section className="glass-panel mx-auto max-w-3xl rounded-2xl border p-6 text-center sm:rounded-3xl sm:p-14">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-leaf-500 text-3xl text-white">✓</div>
        <p className="mt-7 text-xs font-extrabold tracking-[0.2em] text-leaf-600 uppercase">Session complete</p>
        <h2 className="mt-3 font-serif text-4xl font-bold sm:text-5xl">You recalled {verse.reference}.</h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-700">You completed two clean full recitations and a starting-point checkpoint.{!!session.skippedStages?.length && ` You skipped ${session.skippedStages.length} earlier learning ${session.skippedStages.length === 1 ? 'stage' : 'stages'}.`}</p>
        <div className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-2 sm:gap-3">
          <Stat value={session.attempts.length} label="Attempts" />
          <Stat value={gotIt} label="Got it" />
          <Stat value={chunks.length} label="Chunks" />
        </div>
        <button onClick={onRestart} className={`${buttonBase} mt-9 bg-paper-200 hover:bg-paper-300`}>Practice again</button>
      </section></div>
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
              const skipped = session.skippedStages?.includes(item.id)
              const done = index < session.stageIndex && !skipped
              return (
                <li key={item.id} className={`flex min-w-0 items-center gap-2 rounded-xl p-2.5 sm:gap-3 sm:p-3 ${active ? 'bg-river-600 text-white' : 'text-ink-700'}`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ${active ? 'bg-white text-river-600' : done ? 'bg-leaf-500 text-white' : 'bg-paper-200'}`}>{skipped ? '↷' : done ? '✓' : index + 1}</span>
                  <span className="text-sm font-bold leading-tight">{item.name}{skipped && <span className="mt-1 block text-xs font-normal">Skipped</span>}</span>
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

      <section className="order-1 min-w-0 lg:order-2">
        {fullVerse}
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
            key={`${session.stageIndex}-${unit.id}-${session.progress[unit.id]?.attempts ?? 0}`}
            unit={unit}
            chunks={chunks}
            progress={session.progress[unit.id]}
            onRate={commitRating}
          />
        )}
        {canSkip && <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => onUpdate(skipToStage(session, chunks))} aria-keyshortcuts="s" className={`${buttonBase} glass-control border text-sm`}>Skip this stage <kbd aria-hidden="true" className="ml-2 text-xs text-ink-700">S</kbd></button>
          <button onClick={() => onUpdate(skipToStage(session, chunks, STAGES.length - 1))} aria-keyshortcuts="Shift+s" className={`${buttonBase} glass-control border text-sm`}>Jump to full recitation <kbd aria-hidden="true" className="ml-2 text-xs text-ink-700">Shift+S</kbd></button>
        </div>}
        <p className="mt-3 text-xs leading-relaxed text-ink-700">F: full verse · S: skip stage · Shift+S: full recitation. Shortcuts pause while typing. Skipping does not count as a clean recall.</p>
      </section>
    </div>
  )
}

function RecallCard({ unit, chunks, progress, onRate }: { unit: PracticeSession['units'][string]; chunks: string[]; progress: PracticeSession['progress'][string]; onRate: (rating: Rating, troubleChunk?: number) => void }) {
  const [phase, setPhase] = useState<'study' | 'recall' | 'typing' | 'typed-result' | 'check'>('study')
  const [pendingRating, setPendingRating] = useState<'again' | 'hard'>()
  const [typedAnswer, setTypedAnswer] = useState('')
  const [typedGrade, setTypedGrade] = useState<TypedRecallGrade>()
  const [selectedRating, setSelectedRating] = useState<Rating>('again')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const rate = (rating: Rating) => {
    if (rating !== 'got-it' && unit.chunkIndexes.length > 1) setPendingRating(rating)
    else onRate(rating, rating === 'got-it' ? undefined : unit.chunkIndexes[0])
  }

  const startTyping = () => {
    setPhase('typing')
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const submitTypedAnswer = () => {
    const grade = gradeTypedRecall(unit.text, typedAnswer)
    setTypedGrade(grade)
    setSelectedRating(grade.rating)
    setPhase('typed-result')
  }

  const continueTypedResult = () => {
    onRate(selectedRating, typedTroubleChunk())
  }

  const typedTroubleChunk = () => {
    if (!typedGrade || selectedRating === 'got-it') return undefined
    const wordIndex = typedGrade.troubleExpectedWordIndex ?? 0

    if (unit.id.startsWith('transition-') && unit.chunkIndexes.length === 2) {
      const firstChunkWords = Math.min(3, normalizeRecallText(chunks[unit.chunkIndexes[0]]).length)
      return wordIndex < firstChunkWords ? unit.chunkIndexes[0] : unit.chunkIndexes[1]
    }

    let wordsSeen = 0
    for (const chunkIndex of unit.chunkIndexes) {
      wordsSeen += normalizeRecallText(chunks[chunkIndex]).length
      if (wordIndex < wordsSeen) return chunkIndex
    }
    return unit.chunkIndexes.at(-1) ?? unit.chunkIndexes[0]
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || (event.target instanceof HTMLElement && event.target.isContentEditable)) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement || pendingRating) return
      if (event.code === 'Space') {
        event.preventDefault()
        if (phase === 'study') setPhase('recall')
        else if (phase === 'recall') setPhase('check')
      }
      if (event.key === 'Enter') {
        if (phase === 'recall') {
          event.preventDefault()
          startTyping()
        } else if (phase === 'typed-result') {
          event.preventDefault()
          continueTypedResult()
        }
      }
      if (phase === 'check' && event.key === '1') rate('again')
      if (phase === 'check' && event.key === '2') rate('hard')
      if (phase === 'check' && event.key === '3') rate('got-it')
      if (phase === 'typed-result' && event.key === '1') setSelectedRating('again')
      if (phase === 'typed-result' && event.key === '2') setSelectedRating('hard')
      if (phase === 'typed-result' && event.key === '3') setSelectedRating('got-it')
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
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${phase === 'study' ? 'bg-river-100 text-river-600' : phase === 'recall' || phase === 'typing' ? 'bg-amber-100 text-amber-800' : 'bg-leaf-100 text-leaf-600'}`}>
          {phase === 'study' ? 'Study' : phase === 'recall' ? 'Covered' : phase === 'typing' ? 'Type' : 'Check'}
        </span>
      </div>

      <div className={`grid min-h-[280px] place-items-center p-5 text-center sm:min-h-[340px] sm:p-12 ${phase === 'recall' || phase === 'typing' ? 'bg-ink-900/92 text-white backdrop-blur-2xl' : 'glass-strong'}`}>
        {phase === 'recall' ? (
          <div>
            <p className="text-xs font-extrabold tracking-[0.2em] text-paper-300 uppercase">No peeking</p>
            <h3 className="mt-4 font-serif text-4xl font-bold">Say it out loud.</h3>
            <p className="mt-4 text-paper-300">Retrieve the words, then reveal the text or type your answer.</p>
          </div>
        ) : phase === 'typing' ? (
          <form id={`typed-recall-${unit.id}`} className="w-full max-w-2xl text-left" onSubmit={(event) => { event.preventDefault(); submitTypedAnswer() }}>
            <label htmlFor={`typed-answer-${unit.id}`} className="block text-xs font-extrabold tracking-[0.2em] text-paper-300 uppercase">Type from memory</label>
            <textarea
              ref={textareaRef}
              id={`typed-answer-${unit.id}`}
              value={typedAnswer}
              onChange={(event) => setTypedAnswer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  submitTypedAnswer()
                }
              }}
              rows={7}
              autoComplete="off"
              autoCapitalize="sentences"
              spellCheck={false}
              placeholder="Type the passage here…"
              className="mt-4 w-full resize-y rounded-2xl border border-white/20 bg-white/10 p-4 text-lg leading-relaxed text-white outline-none placeholder:text-paper-300/60 focus:border-river-500 focus:ring-3 focus:ring-river-500/30"
            />
            <p className="mt-3 text-sm text-paper-300">Capitalization, punctuation, and extra spaces do not affect your score.</p>
          </form>
        ) : phase === 'typed-result' && typedGrade ? (
          <TypedRecallReview grade={typedGrade} selectedRating={selectedRating} />
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
          <button onClick={() => setPhase('recall')} aria-keyshortcuts="Space" className={`${buttonBase} w-full bg-river-600 text-white hover:bg-river-500`}>Cover & recall <span aria-hidden="true" className="ml-2 hidden text-white/60 sm:inline">Space</span></button>
        ) : phase === 'recall' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={startTyping} aria-keyshortcuts="Enter" className={`${buttonBase} bg-river-600 text-white hover:bg-river-500`}>Type your answer <span aria-hidden="true" className="ml-2 hidden text-white/60 sm:inline">Enter</span></button>
            <button onClick={() => setPhase('check')} aria-keyshortcuts="Space" className={`${buttonBase} bg-white text-ink-900 ring-1 ring-paper-300 hover:bg-paper-100`}>Reveal & check <span aria-hidden="true" className="ml-2 hidden text-ink-700/60 sm:inline">Space</span></button>
          </div>
        ) : phase === 'typing' ? (
          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <button onClick={() => setPhase('recall')} className={`${buttonBase} bg-paper-200 text-ink-900 hover:bg-paper-300`}>Cancel</button>
            <button type="submit" form={`typed-recall-${unit.id}`} aria-keyshortcuts="Enter" className={`${buttonBase} bg-river-600 text-white hover:bg-river-500`}>Check my answer <span aria-hidden="true" className="ml-2 hidden text-white/60 sm:inline">Enter</span></button>
          </div>
        ) : phase === 'typed-result' && typedGrade ? (
          <div>
            <fieldset>
              <legend className="mb-3 w-full text-center text-sm font-bold text-ink-700">Assigned pile — change it if needed</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                <RatingChoice rating="again" selected={selectedRating === 'again'} onSelect={setSelectedRating} />
                <RatingChoice rating="hard" selected={selectedRating === 'hard'} onSelect={setSelectedRating} />
                <RatingChoice rating="got-it" selected={selectedRating === 'got-it'} onSelect={setSelectedRating} />
              </div>
            </fieldset>
            <button onClick={continueTypedResult} aria-keyshortcuts="Enter" className={`${buttonBase} mt-3 w-full bg-ink-900 text-white hover:bg-ink-700`}>Continue with {ratingLabel(selectedRating)} → <span aria-hidden="true" className="ml-2 hidden text-white/60 sm:inline">Enter</span></button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            <button onClick={() => rate('again')} aria-keyshortcuts="1" className={`${buttonBase} bg-rose-100 text-rose-800 hover:bg-rose-200`}>Again <span aria-hidden="true" className="ml-1 hidden opacity-50 sm:inline">1</span></button>
            <button onClick={() => rate('hard')} aria-keyshortcuts="2" className={`${buttonBase} bg-amber-100 text-amber-900 hover:bg-amber-200`}>Hard <span aria-hidden="true" className="ml-1 hidden opacity-50 sm:inline">2</span></button>
            <button onClick={() => rate('got-it')} aria-keyshortcuts="3" className={`${buttonBase} bg-leaf-600 text-white hover:bg-leaf-500`}>Got it <span aria-hidden="true" className="ml-1 hidden opacity-60 sm:inline">3</span></button>
          </div>
        )}
      </div>
    </div>
  )
}

function ratingLabel(rating: Rating) {
  return rating === 'got-it' ? 'Got it' : rating === 'hard' ? 'Hard' : 'Again'
}

function RatingChoice({ rating, selected, onSelect }: { rating: Rating; selected: boolean; onSelect: (rating: Rating) => void }) {
  const colors = rating === 'again'
    ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
    : rating === 'hard'
      ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
      : 'bg-leaf-600 text-white hover:bg-leaf-500'
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(rating)}
      className={`${buttonBase} ${colors} ${selected ? 'ring-3 ring-river-500/40' : 'opacity-65'}`}
    >
      {ratingLabel(rating)}
    </button>
  )
}

function TypedRecallReview({ grade, selectedRating }: { grade: TypedRecallGrade; selectedRating: Rating }) {
  const expectedTokens = grade.alignment.filter((token) => token.expected)
  const actualTokens = grade.alignment.filter((token) => token.actual)
  return (
    <div className="w-full max-w-3xl text-left" aria-live="polite">
      <div className="text-center">
        <p className="text-xs font-extrabold tracking-[0.18em] text-leaf-600 uppercase">Automatic result</p>
        <h3 className="mt-2 font-serif text-3xl font-bold">{ratingLabel(selectedRating)}</h3>
        <p className="mt-2 text-sm text-ink-700">{grade.editDistance === 0 ? 'Exact words after ignoring punctuation and capitalization.' : `${grade.editDistance} word ${grade.editDistance === 1 ? 'difference' : 'differences'} · Hard allows up to ${grade.hardErrorAllowance}.`}</p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <DiffLine label="Expected" tokens={expectedTokens} side="expected" />
        <DiffLine label="Your answer" tokens={actualTokens} side="actual" emptyText="No words entered" />
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs font-bold text-ink-700">
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-rose-300" />Missing or different</span>
        <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-300" />Extra</span>
      </div>
    </div>
  )
}

function DiffLine({ label, tokens, side, emptyText }: { label: string; tokens: TypedRecallGrade['alignment']; side: 'expected' | 'actual'; emptyText?: string }) {
  return (
    <div className="rounded-2xl border border-paper-300 bg-white p-4">
      <p className="text-xs font-extrabold tracking-wider text-ink-700 uppercase">{label}</p>
      <p className="mt-3 font-serif text-lg leading-loose">
        {tokens.length === 0 && <span className="font-sans text-sm text-ink-700 italic">{emptyText}</span>}
        {tokens.map((token, index) => {
          const text = side === 'expected' ? token.expected : token.actual
          const changed = token.kind === 'substitution' || token.kind === 'missing'
          const extra = token.kind === 'extra'
          return <span key={`${index}-${text}`} className={`mr-1 rounded px-1 py-0.5 ${changed ? 'bg-rose-100 text-rose-900' : extra ? 'bg-amber-100 text-amber-900' : ''}`}>{text}</span>
        })}
      </p>
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
