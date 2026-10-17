import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Verse } from '../types'

export function FullVerseReader({ verse, onClose }: { verse: Verse; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!
    const previousFocus = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = overflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])

  return createPortal(<dialog
    ref={dialog}
    aria-label="Full verse"
    className="full-verse-reader"
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onKeyDown={(event) => {
      event.stopPropagation()
      if (event.key.toLowerCase() === 'f' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault()
        onClose()
      }
    }}
  >
    <section id="full-verse-reference" aria-label="Full verse reference" className="flex min-h-full flex-col">
      <div className="reader-toolbar flex items-center justify-between gap-4 border-b border-paper-300">
        <h2 className="font-serif text-xl font-bold text-river-600">{verse.reference}</h2>
        <button onClick={onClose} className="min-h-14 shrink-0 rounded-xl bg-paper-200 px-5 py-3 font-bold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-river-500/40">Close <span aria-hidden="true">×</span></button>
      </div>
      <div className="flex flex-1 items-center px-5 py-8 sm:px-10">
        <p className="whitespace-pre-line font-serif text-[clamp(1.75rem,6vw,2.5rem)] leading-relaxed font-semibold">{verse.text}</p>
      </div>
    </section>
  </dialog>, document.body)
}
