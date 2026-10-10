// The Audio Session API is not available in every browser or in our DOM typings.
type AudioSession = { type: string }
type NavigatorWithAudioSession = Navigator & { audioSession?: AudioSession }

/** Request media playback routing; iOS still chooses the actual output device. */
export function requestPlaybackAudioSession(): () => void {
  try {
    const session = (navigator as NavigatorWithAudioSession).audioSession
    if (!session) return () => {}
    const previous = session.type
    session.type = 'playback'
    return () => {
      try {
        // Do not overwrite a newer request from another audio feature.
        if (session.type === 'playback') session.type = previous
      } catch { /* Some browser versions expose the API but reject changes. */ }
    }
  } catch {
    // A routing hint must never prevent otherwise working speech playback.
    return () => {}
  }
}
