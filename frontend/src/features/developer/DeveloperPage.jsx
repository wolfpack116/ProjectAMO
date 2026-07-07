import { useEffect, useState } from 'react'
import { TabList, Tab, MessageBar, MessageBarBody, Spinner, Link, makeStyles, tokens } from '../../shared/ui/fluent.js'
import { getHealth } from './developerApi.js'
import TriggerTab from './tabs/TriggerTab.jsx'
import ObserveTab from './tabs/ObserveTab.jsx'

const useStyles = makeStyles({
  page: { maxWidth: '960px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '16px' },
  head: { display: 'flex', alignItems: 'baseline', gap: '12px' },
  title: { fontSize: tokens.fontSizeHero700, fontWeight: tokens.fontWeightSemibold },
  sub: { color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 },
})

// /dev 개발자 콘솔 — ① 조작(Trigger) + ② 관찰(Observe). 테스트 인스턴스(npm run dev:test)에서만 동작.
// 게이트: App.jsx가 import.meta.env.DEV로 라우트 자체를 운영 빌드에서 제거 + 여기서 런타임 testMode 재확인.
export default function DeveloperPage() {
  const s = useStyles()
  const [tab, setTab] = useState('trigger')
  const [testMode, setTestMode] = useState(null) // null=확인중

  useEffect(() => {
    getHealth().then((d) => setTestMode(!!d.testMode)).catch(() => setTestMode(false))
  }, [])

  if (testMode === null) return <div className={s.page}><Spinner label="확인 중…" /></div>

  return (
    <div className={s.page}>
      <div className={s.head}>
        <span className={s.title}>개발자 콘솔</span>
        <span className={s.sub}>조작 + 관찰 · 테스트 인스턴스 전용</span>
      </div>

      {!testMode ? (
        <MessageBar intent="warning">
          <MessageBarBody>
            테스트 인스턴스에서만 동작합니다. <code>npm run dev:test</code>로 서버를 띄운 뒤 다시 접속하세요.
            (일반 모드에선 주입이 자동수집에 되돌려져 무의미하므로 백엔드가 dev API를 아예 열지 않습니다.)
          </MessageBarBody>
        </MessageBar>
      ) : (
        <>
          <TabList selectedValue={tab} onTabSelect={(_, d) => setTab(d.value)}>
            <Tab value="trigger">① 조작</Tab>
            <Tab value="observe">② 관찰</Tab>
          </TabList>
          {tab === 'trigger' && <TriggerTab />}
          {tab === 'observe' && <ObserveTab />}
        </>
      )}
      <Link href="/">← 메인으로</Link>
    </div>
  )
}
