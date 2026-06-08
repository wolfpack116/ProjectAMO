import { createContext, useContext, useMemo, useState } from 'react'

const TimeZoneContext = createContext({ tz: 'KST', setTz: () => {} })

export function TimeZoneProvider({ children }) {
  const [tz, setTz] = useState(() => localStorage.getItem('time_zone') || 'KST')
  const value = useMemo(() => ({ tz, setTz }), [tz])
  return (
    <TimeZoneContext.Provider value={value}>
      {children}
    </TimeZoneContext.Provider>
  )
}

export function useTimeZone() {
  return useContext(TimeZoneContext)
}
