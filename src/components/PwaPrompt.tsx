import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PwaPrompt() {
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState(false)
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Could not enable offline use:', error)
    },
  })

  if (!offlineReady && !needRefresh) return null

  const dismiss = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
    setUpdateError(false)
  }

  const update = async () => {
    setUpdating(true)
    setUpdateError(false)
    try {
      await updateServiceWorker(true)
    } catch {
      setUpdateError(true)
    } finally {
      setUpdating(false)
    }
  }

  return <aside
    aria-label="App availability"
    className="glass-strong fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-50 rounded-2xl border p-4 text-ink-900 sm:right-[max(1rem,env(safe-area-inset-right))] sm:left-auto sm:max-w-sm"
    onKeyDown={(event) => event.stopPropagation()}
  >
    <p role="status" className="text-sm font-semibold">
      {needRefresh ? 'A new version of Verse Memory is ready.' : 'Ready for offline practice.'}
    </p>
    <p className="mt-1 text-sm text-ink-700">
      {needRefresh ? 'Reload when you’re ready. Your saved progress will be kept.' : 'Your verses and saved progress are available on this device, even without internet.'}
    </p>
    {updateError && <p role="alert" className="mt-2 text-sm text-ink-700">Could not update. Please try again when you’re online.</p>}
    <div className="mt-3 flex gap-2">
      {needRefresh && <button
        type="button"
        disabled={updating}
        onClick={() => void update()}
        className="rounded-xl bg-river-600 px-4 py-2 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-river-500/30 disabled:opacity-40"
      >{updating ? 'Updating…' : 'Reload to update'}</button>}
      <button
        type="button"
        onClick={dismiss}
        className="glass-control rounded-xl border px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-river-500/30"
      >{needRefresh ? 'Later' : 'Got it'}</button>
    </div>
  </aside>
}
