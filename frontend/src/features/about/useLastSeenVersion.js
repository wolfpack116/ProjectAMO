import { useCallback, useState } from 'react'
import { CURRENT_VERSION } from './changelog.js'

const STORAGE_KEY = 'projectamo:lastSeenVersion'

function readLastSeen() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

// Tracks the latest changelog version the user has opened. `hasUpdate` is true when
// the current release differs from what they last saw (including first-ever visit).
export function useLastSeenVersion() {
  const [lastSeen, setLastSeen] = useState(readLastSeen)

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    } catch {
      // ignore storage failures
    }
    setLastSeen(CURRENT_VERSION)
  }, [])

  return { hasUpdate: lastSeen !== CURRENT_VERSION, markSeen }
}
