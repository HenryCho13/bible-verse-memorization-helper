import { useState } from 'react'
import { parseImportedVerses, type ImportedVerse } from '../data/importVerses'
import type { Verse } from '../types'

const field = 'mt-2 w-full rounded-xl border border-paper-300 bg-white px-4 py-3 outline-none focus:border-river-500 focus:ring-3 focus:ring-river-500/15'
const button = 'min-h-12 rounded-xl px-4 py-3 font-bold focus-visible:ring-3 focus-visible:ring-river-500/30'

export function PersonalLibrary({ verses, onImport, onPractice }: { verses: Verse[]; onImport: (verses: ImportedVerse[]) => number; onPractice: (verse: Verse) => void }) {
  const [reference, setReference] = useState('')
  const [text, setText] = useState('')
  const [bulk, setBulk] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  const importEntries = (entries: ImportedVerse[]) => {
    const count = onImport(entries)
    setError('')
    setMessage(count ? `Added ${count} ${count === 1 ? 'verse' : 'verses'} to My verses.` : 'These verses are already in your library.')
  }
  const importText = (source: string) => {
    try {
      importEntries(parseImportedVerses(source))
      setBulk('')
    } catch (error) {
      setMessage('')
      setError(error instanceof Error ? error.message : 'The verses could not be imported.')
    }
  }
  const query = search.trim().toLowerCase()
  const filtered = verses.filter((verse) => `${verse.reference} ${verse.text} ${verse.topic}`.toLowerCase().includes(query))

  return <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
    <h1 className="font-serif text-3xl font-bold sm:text-4xl">My verses</h1>
    <p className="mt-3 max-w-2xl leading-relaxed text-ink-700">A personal collection, separate from your weekly plan. Verses and practice progress are saved in this browser.</p>
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="glass-panel min-w-0 rounded-2xl border p-5">
        <h2 className="text-xl font-bold">Add a verse</h2>
        <form className="mt-4 space-y-4" onSubmit={(event) => {
          event.preventDefault()
          if (!reference.trim() || !text.trim()) { setMessage(''); setError('Enter both a reference and the verse text.'); return }
          importEntries([{ reference: reference.trim(), text: text.trim(), topic: 'Personal memorization' }])
          setReference(''); setText('')
        }}>
          <label className="block font-bold">Reference<input required value={reference} onChange={(event) => setReference(event.target.value)} placeholder="John 3:16" className={field} /></label>
          <label className="block font-bold">Verse text<textarea required rows={5} value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste the full passage…" className={field} /></label>
          <button className={`${button} w-full bg-river-600 text-white hover:bg-river-500`}>Add to My verses</button>
        </form>
        <details className="mt-6 border-t border-paper-300 pt-4">
          <summary className="cursor-pointer py-2 font-bold">Import multiple verses</summary>
          <p id="import-help" className="mt-3 text-sm leading-relaxed text-ink-700">Paste one verse per line, or choose a .txt or .json file. Text format: <span className="block mt-2 rounded-lg bg-paper-100 p-2">John 3:16 — For God so loved…</span></p>
          <p className="mt-3 text-sm text-ink-700">JSON format: an array of objects with “reference” and “text” fields, plus an optional “topic”. Exact duplicates are skipped.</p>
          <label className="mt-4 block font-bold">Verses to import<textarea aria-describedby="import-help" rows={5} value={bulk} onChange={(event) => setBulk(event.target.value)} className={field} /></label>
          <button onClick={() => importText(bulk)} className={`${button} mt-3 w-full bg-paper-200 hover:bg-paper-300`}>Import pasted verses</button>
          <label className="mt-5 block text-sm font-bold">Import a file<input type="file" accept=".txt,.json,text/plain,application/json" className="mt-2 block w-full min-w-0 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-paper-200 file:p-3" onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            try { importText(await file.text()) } catch { setMessage(''); setError('This file could not be read. Try pasting its contents instead.') }
          }} /></label>
        </details>
        {error && <p role="alert" className="mt-4 text-sm font-bold text-rose-800">{error}</p>}
        {message && <p role="status" className="mt-4 text-sm font-bold text-leaf-600">{message}</p>}
      </section>
      <section className="min-w-0" aria-label="Personal verse library">
        <label className="block font-bold">Search My verses<input value={search} onChange={(event) => setSearch(event.target.value)} className={field} placeholder="Search reference or words" /></label>
        <p className="my-4 text-sm text-ink-700">{filtered.length} {filtered.length === 1 ? 'verse' : 'verses'}</p>
        <div className="space-y-4">
          {filtered.map((verse) => <article key={verse.id} className="glass-panel rounded-2xl border p-5">
            <h2 className="font-serif text-2xl font-bold">{verse.reference}</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-700">{verse.text}</p>
            <button onClick={() => onPractice(verse)} aria-label={`Practice ${verse.reference}`} className={`${button} mt-4 bg-river-600 text-white hover:bg-river-500`}>Practice →</button>
          </article>)}
          {filtered.length === 0 && <p className="glass-panel rounded-2xl border p-6 leading-relaxed text-ink-700">{verses.length ? 'No verses match your search.' : 'Add your first passage to start a personal practice session.'}</p>}
        </div>
      </section>
    </div>
  </main>
}
