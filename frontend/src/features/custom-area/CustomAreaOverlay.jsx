import { Button, makeStyles } from '../../shared/ui/fluent.js'
import { useCustomAreaOverlay } from './useCustomAreaOverlay.js'

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
  row: {
    display: 'flex',
    gap: 'var(--space-xs)',
  },
})

function CustomAreaOverlay({ mapRef, isStyleReady, onClose }) {
  const s = useStyles()
  const {
    drawing, vertCount, polyCount, hasSelection,
    handleStart, handleCancel, handleUndo, handleDeleteSelected, handleDeleteAll,
  } = useCustomAreaOverlay(mapRef, isStyleReady)

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
            <Button appearance="secondary" onClick={handleDeleteSelected}>선택 구역 삭제</Button>
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
          <span className={s.status}>{vertCount}개 점 찍음 · 지도를 클릭해 점을 추가하세요</span>
          <div className={s.row}>
            <Button appearance="secondary" onClick={handleCancel}>취소</Button>
            <Button appearance="secondary" disabled={vertCount === 0} onClick={handleUndo}>마지막 점 취소</Button>
          </div>
        </>
      )}
    </div>
  )
}

export default CustomAreaOverlay
