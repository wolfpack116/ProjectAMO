import { Button, MessageBar, MessageBarBody } from '../../shared/ui/fluent.js'

const KIND_LABEL = { route: '계획 경로', track: '실제 궤적', points: '지점 모음' }

// 파일에 경로 후보가 여러 개일 때만 뜨는 선택 목록. 단일 후보면 이 컴포넌트를
// 아예 렌더하지 않는다(호출부 조건부 렌더).
export default function RouteImportChooser({ candidates, onSelect, onCancel }) {
  if (!candidates || candidates.length === 0) return null

  return (
    <MessageBar intent="info">
      <MessageBarBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span>{'파일에 경로가 여러 개 있습니다. 하나를 선택하세요.'}</span>
          {candidates.map((candidate, index) => (
            <Button
              key={`${candidate.label}-${index}`}
              appearance="secondary"
              size="small"
              onClick={() => onSelect(candidate)}
            >
              {`${candidate.label} · ${KIND_LABEL[candidate.kind] ?? candidate.kind} · ${candidate.coords.length}점`}
            </Button>
          ))}
          <Button appearance="subtle" size="small" onClick={onCancel}>{'취소'}</Button>
        </div>
      </MessageBarBody>
    </MessageBar>
  )
}
