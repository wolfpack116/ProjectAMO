import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './MobileSheet.css'

// Shared non-modal mobile bottom sheet: grabber handle, peek/half/full detents
// with pointer-drag snapping, and a scrollable body. Anchored flush to the
// bottom of its positioned parent (the map wrapper) so it sits on the task bar.
// Degrades to a fixed half-height sheet when pointer events are unavailable.

const DETENTS = ['peek', 'half', 'full']
const hasPointer = typeof window !== 'undefined' && 'PointerEvent' in window

function detentHeight(detent, fullPx) {
  const h = (typeof window !== 'undefined' && window.innerHeight) || 800
  if (detent === 'peek') return 66
  // Full = flush to the top of the positioned parent (the map wrapper, which is
  // 100dvh minus the task bar). Falls back to 0.9h before the parent is measured.
  if (detent === 'full') return fullPx ?? Math.round(h * 0.9)
  return Math.round(h * 0.55)
}

export default function MobileSheet({
  open,
  eyebrow,
  title,
  onClose,
  headerExtra,
  peekContent,
  footer,
  children,
  detent: detentProp,
  onDetentChange,
}) {
  const [internalDetent, setInternalDetent] = useState('half')
  const detent = detentProp ?? internalDetent
  const setDetent = (next) => {
    if (onDetentChange) onDetentChange(next)
    else setInternalDetent(next)
  }

  const [dragH, setDragH] = useState(null)
  const dragRef = useRef(null)
  const rootRef = useRef(null)

  // Measure the positioned parent (map wrapper) so the full detent sits flush to
  // its top edge — no sliver of map peeking above the sheet. A ResizeObserver
  // catches the initial layout and any viewport change.
  const [fullPx, setFullPx] = useState(null)
  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement
    if (!open || !parent) return undefined
    const measure = () => setFullPx(parent.clientHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [open])

  // At the full detent, flag the document so the map chrome (status strip, layer
  // chips, basemap switcher) hides behind the now full-screen sheet.
  useEffect(() => {
    const isFull = open && detent === 'full'
    document.body.classList.toggle('amo-sheet-full', isFull)
    return () => document.body.classList.remove('amo-sheet-full')
  }, [open, detent])

  function onPointerDown(event) {
    if (!hasPointer) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = { startY: event.clientY, startH: detentHeight(detent, fullPx), moved: false }
    setDragH(detentHeight(detent, fullPx))
  }

  function onPointerMove(event) {
    const drag = dragRef.current
    if (!drag) return
    const delta = event.clientY - drag.startY
    if (Math.abs(delta) > 5) drag.moved = true
    const next = Math.min(detentHeight('full', fullPx), Math.max(detentHeight('peek', fullPx), drag.startH - delta))
    setDragH(next)
  }

  function onPointerUp() {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    if (!drag.moved) {
      // Tap on the grabber cycles detents (discoverability fallback).
      const idx = DETENTS.indexOf(detent)
      setDetent(DETENTS[(idx + 1) % DETENTS.length])
      setDragH(null)
      return
    }
    const current = dragH ?? detentHeight(detent, fullPx)
    let nearest = 'half'
    let best = Infinity
    for (const candidate of DETENTS) {
      const diff = Math.abs(detentHeight(candidate, fullPx) - current)
      if (diff < best) { best = diff; nearest = candidate }
    }
    setDetent(nearest)
    setDragH(null)
  }

  if (!open) return null

  const height = dragH ?? detentHeight(detent, fullPx)
  const dragHandlers = hasPointer
    ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
    : {}
  const showPeek = detent === 'peek' && peekContent != null

  return (
    <div
      ref={rootRef}
      className={`mobile-sheet${dragRef.current ? ' is-dragging' : ''}${detent === 'full' ? ' is-full' : ''}`}
      style={{ height: `${height}px` }}
      role="dialog"
      aria-label={title}
    >
      <div className="mobile-sheet-grab" {...dragHandlers}>
        <span className="mobile-sheet-grab-handle" aria-hidden="true" />
      </div>
      {showPeek ? (
        <button
          type="button"
          className="mobile-sheet-peek"
          onClick={() => setDetent('half')}
          aria-label="브리핑 펼치기"
        >
          {peekContent}
        </button>
      ) : (
        <>
          <div className="mobile-sheet-header">
            <div className="mobile-sheet-titles">
              {eyebrow && <div className="mobile-sheet-eyebrow">{eyebrow}</div>}
              <div className="mobile-sheet-title">{title}</div>
            </div>
            {headerExtra && <div className="mobile-sheet-header-extra">{headerExtra}</div>}
            <button type="button" className="mobile-sheet-close" onClick={onClose} aria-label="닫기">×</button>
          </div>
          <div className="mobile-sheet-body">{children}</div>
          {footer && <div className="mobile-sheet-footer">{footer}</div>}
        </>
      )}
    </div>
  )
}
