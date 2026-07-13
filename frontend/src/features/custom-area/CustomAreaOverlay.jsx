import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Input, makeStyles, mergeClasses } from '../../shared/ui/fluent.js'
import { COLOR_OPTIONS } from './usePolygonDraw.js'

const useStyles = makeStyles({
  panel: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-s)',
    width: '220px',
    padding: 'var(--space-m)',
    border: '1px solid var(--stroke-2)',
    borderRadius: 'var(--radius-lg)',
    background: 'rgba(255, 255, 255, 0.94)',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.12)',
    fontFamily: 'var(--font-base)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 'var(--fs-300)',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-1)',
  },
  closeBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: 'var(--text-3)',
    fontSize: 'var(--fs-400)',
    lineHeight: 1,
    padding: 'var(--space-xxs)',
  },
  status: {
    fontSize: 'var(--fs-200)',
    color: 'var(--text-2)',
  },
  coordSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
    marginTop: 'var(--space-xxs)',
    padding: 'var(--space-s)',
    border: '1px solid var(--stroke-2)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-2)',
  },
  coordTitle: {
    fontSize: 'var(--fs-200)',
    fontWeight: 'var(--fw-semibold)',
    color: 'var(--text-2)',
  },
  coordRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-xs)',
  },
  coordLabel: {
    fontSize: 'var(--fs-200)',
    color: 'var(--text-2)',
    flexShrink: 0,
  },
  coordInput: {
    width: '110px',
  },
  coordError: {
    fontSize: 'var(--fs-100)',
    color: 'var(--level-red)',
  },
  colorSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-xs)',
    marginTop: 'var(--space-xxs)',
  },
  colorGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-xs)',
  },
  colorSwatch: {
    width: '26px',
    height: '26px',
    borderRadius: 'var(--radius-circular)',
    border: '2px solid transparent',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  colorSwatchSelected: {
    border: '2px solid var(--text-1)',
    boxShadow: '0 0 0 2px var(--bg-1)',
  },
})

function CustomAreaOverlay({
  drawing, vertCount, polyCount, hasSelection, selectedColor, selectedFeatureColor,
  handleStart, handleCancel, handleUndo, handleDeleteSelected, handleDeleteAll, handleChangeSelectedColor,
  addVertex, setColor, onClose,
}) {
  const s = useStyles()
  const [coordInput, setCoordInput] = useState({ lat: '', lng: '' })
  const [coordError, setCoordError] = useState('')

  function handleCoordAdd(e) {
    e.preventDefault()
    const lat = parseFloat(coordInput.lat)
    const lng = parseFloat(coordInput.lng)
    if (isNaN(lat) || lat < -90 || lat > 90) {
      setCoordError('위도는 -90 ~ 90 사이 숫자여야 합니다.')
      return
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      setCoordError('경도는 -180 ~ 180 사이 숫자여야 합니다.')
      return
    }
    setCoordError('')
    addVertex(lng, lat)
    setCoordInput({ lat: '', lng: '' })
  }

  return (
    <div className={s.panel} aria-label="임의 구역 설정">
      <div className={s.header}>
        <span>임의 구역 설정</span>
        <button type="button" className={s.closeBtn} onClick={onClose} aria-label="닫기">×</button>
      </div>

      {!drawing ? (
        <>
          <Button appearance="primary" onClick={handleStart}>구역 그리기 시작</Button>
          {hasSelection && (
            <>
              <Button appearance="secondary" onClick={handleDeleteSelected}>선택 구역 삭제</Button>
              <div className={s.colorSection}>
                <span className={s.coordTitle}>선택 구역 색상 변경</span>
                <div className={s.colorGrid} role="group" aria-label="선택 구역 색상 변경">
                  {COLOR_OPTIONS.map((opt) => {
                    const isSelected = selectedFeatureColor === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={mergeClasses(s.colorSwatch, isSelected && s.colorSwatchSelected)}
                        style={{ backgroundColor: opt.value }}
                        aria-label={opt.label}
                        aria-pressed={isSelected}
                        onClick={() => handleChangeSelectedColor(opt.value)}
                      >
                        {isSelected && <Check size={14} color={opt.checkColor} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
          {polyCount > 0 && (
            <Button appearance="secondary" onClick={handleDeleteAll}>전체 구역 삭제 ({polyCount})</Button>
          )}
          {polyCount > 0 && !hasSelection && (
            <span className={s.status}>구역 클릭 시 선택</span>
          )}
        </>
      ) : (
        <>
          <Button appearance="secondary" onClick={handleCancel}>그리기 취소</Button>
          <Button appearance="secondary" disabled={vertCount === 0} onClick={handleUndo}>마지막 점 취소</Button>
          <span className={s.status}>{vertCount}개 점 찍음</span>

          <form className={s.coordSection} onSubmit={handleCoordAdd}>
            <span className={s.coordTitle}>좌표 직접 입력</span>
            <label className={s.coordRow}>
              <span className={s.coordLabel}>위도</span>
              <Input
                className={s.coordInput}
                type="number"
                step="any"
                placeholder="예: 37.5"
                value={coordInput.lat}
                onChange={(e) => setCoordInput((p) => ({ ...p, lat: e.target.value }))}
              />
            </label>
            <label className={s.coordRow}>
              <span className={s.coordLabel}>경도</span>
              <Input
                className={s.coordInput}
                type="number"
                step="any"
                placeholder="예: 126.9"
                value={coordInput.lng}
                onChange={(e) => setCoordInput((p) => ({ ...p, lng: e.target.value }))}
              />
            </label>
            {coordError && <span className={s.coordError}>{coordError}</span>}
            <Button type="submit" appearance="primary">점 추가</Button>
          </form>

          <div className={s.colorSection}>
            <span className={s.coordTitle}>그리기 색상</span>
            <div className={s.colorGrid} role="group" aria-label="그리기 색상 선택">
              {COLOR_OPTIONS.map((opt) => {
                const isSelected = selectedColor === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={mergeClasses(s.colorSwatch, isSelected && s.colorSwatchSelected)}
                    style={{ backgroundColor: opt.value }}
                    aria-label={opt.label}
                    aria-pressed={isSelected}
                    onClick={() => setColor(opt.value)}
                  >
                    {isSelected && <Check size={14} color={opt.checkColor} />}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default CustomAreaOverlay
