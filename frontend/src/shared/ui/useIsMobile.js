import { useEffect, useState } from 'react'

// Shared mobile breakpoint matcher (mirrors --breakpoint-mobile-max: 719px).
export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 719px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 719px)')
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}
