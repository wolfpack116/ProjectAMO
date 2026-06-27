# 바이브 코딩으로 프론트엔드 UI/UX를 "상업용(프로덕션) 품질"까지 끌어올리는 법

> **통합 리서치 보고서** — GitHub · 커뮤니티 글 · YouTube · AI 툴/워크플로우 4개 트랙을 병렬 조사 후 통합.
> 조사일: 2026-06-27 · 범위: 영어권 + 한국어 소스 · 기준: "정말 쓸 수 있는 것"(과장 제거)

---

## 0. 한 줄 결론 (4개 트랙이 모두 같은 곳으로 수렴)

> **상업용 품질은 "더 좋은 한 방 프롬프트"가 아니라, 워크플로우에서 나온다:**
> **(1) 검증된 컴포넌트 라이브러리를 토대로 깔고 → (2) 디자인 토큰/테마로 "우리만의 룩"을 입히고 → (3) AI에게 디자인 규칙(rules/skill)을 파일로 강제하고 → (4) 스크린샷·접근성·반응형으로 검증 루프를 돈다.**

4개 독립 리서치가 표현은 달라도 **동일한 4단 골격**을 가리켰다는 점이 이번 조사의 가장 강력한 신호다.

| 트랙 | 같은 결론을 부른 표현 |
|---|---|
| GitHub | "shadcn로 깔고 → tweakcn으로 색 입히고 → refactoring-ui 룰로 AI 길들이고 → Playwright MCP로 자기 산출물 보고 고치게 하라" |
| 커뮤니티 | "AI는 디자인하지 않고 학습 데이터의 평균을 낸다. 해법은 언제나 **제약(constraints)**" |
| YouTube | "프롬프트만으로는 안 된다. **레퍼런스 + 디자인 시스템(토큰) + 반복**" (Meng To) |
| AI 워크플로우 | "디자인 시스템(토큰·컴포넌트)을 먼저 고정 → 그 위에서 화면 생성 → 검증 루프" |

---

## 1. 왜 AI UI는 "촌스럽게(AI slop)" 나오는가 — 근본 원인

해결책을 이해하려면 원인부터 알아야 한다.

- **AI는 디자인하지 않고 "평균을 낸다".** 제약 없이 "랜딩 페이지 만들어줘"라고 하면 *2019~2024년 GitHub의 모든 Tailwind 튜토리얼의 중앙값(median)*을 받는다.
- **보라색 그라데이션의 정체:** Tailwind가 5년 전 데모 색으로 `bg-indigo-500`을 골랐고, 이게 수천 개 튜토리얼에 퍼져 학습 데이터를 점령했다.
- **AI slop의 전형:** Inter/Roboto 폰트, 보라/인디고 강조색, 가운데 정렬 히어로, 아이콘 3개 박스 그리드, 흰 배경, 사방 `rounded-2xl` + `shadow-lg`(opacity 0.1).
- **빠져 있는 것:** 크기 외의 시각적 위계, 의도적 색 이론, 타이포 페어링, 디자인 요소로서의 여백, 입력 검증/에러·빈 상태 같은 기능 디테일.
- Anthropic도 공식적으로 모델이 "generic으로 수렴(converge)하는 경향"을 인정한다.

> **핵심:** 원인이 "제약의 부재"임을 받아들이는 것이 출발점. AI는 다양한 디자인을 낼 능력이 충분하고, 단지 제약이 필요할 뿐이다.

참고: [Why Your AI Keeps Building the Same Purple Gradient Website (prg.sh)](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website) · [Blame Tailwind's Indigo-500 (dev.to)](https://dev.to/alanwest/why-every-ai-built-website-looks-the-same-blame-tailwinds-indigo-500-3h2p) · [Is AI causing a repeat of frontend's lost decade? (HN)](https://news.ycombinator.com/item?id=48321631)

---

## 2. 4단 워크플로우 (이 보고서의 본체)

### STEP 1 — 토대: 검증된 컴포넌트 라이브러리

상업용 품질의 약 80%는 "직접 만든 못생긴 버튼" 대신 "검증된 컴포넌트"를 쓰는 데서 결정된다.

| 라이브러리 | 무엇 / 언제 쓰나 | 링크 |
|---|---|---|
| **shadcn/ui** ⭐ | 복사-붙여넣기형(코드가 내 레포로 들어옴). Radix 기반 접근성 + 코드 소유권 100% → AI가 자유롭게 수정. **2026년 React+Tailwind 신규 프로젝트의 사실상 표준** | [ui.shadcn.com](https://ui.shadcn.com) / [GitHub](https://github.com/shadcn-ui/ui) |
| **Radix / Base UI** | 스타일 없는 헤드리스 프리미티브(접근성·키보드·포커스 내장). 접근성 최우선일 때 | [radix-ui.com](https://www.radix-ui.com) |
| **HeroUI (구 NextUI)** | "기본값이 예쁜" 풀 라이브러리. 테마 안 만져도 모던. 빠른 MVP | [GitHub](https://github.com/heroui-inc/heroui) |
| **Mantine** | 100+ 컴포넌트 + 훅. 폼·테이블·데이트피커 많은 풀 앱/내부툴 | [mantine.dev](https://mantine.dev) |
| **Tremor** | 대시보드·차트 전용. SaaS 데이터 화면 | [tremor.so](https://www.tremor.so) |
| **Tailwind Plus** | Tailwind 팀의 유료 프로 컴포넌트/템플릿. 랜딩·마케팅 퀄리티를 돈으로 사기 | [tailwindcss.com/plus](https://tailwindcss.com/plus) |

**선택 가이드:** 코드 소유·커스터마이즈 → shadcn · 접근성 최우선 → Radix/HeroUI · 풀 앱 커버리지 → Mantine · 데이터 대시보드 → Tremor.

**차별화 레이어("다 똑같아 보임" 해결):** 랜딩/마케팅 섹션은 애니메이션·블록 라이브러리로 "와우 모먼트"를 추가한다 — [Aceternity UI](https://ui.aceternity.com), [Magic UI](https://github.com/magicuidesign/magicui), 블록 모음 [shadcn.io](https://www.shadcn.io)·[ReUI](https://reui.io). 모두 Tailwind+Motion 스택이라 shadcn과 혼용이 쉽다.

> **업계 표준 패턴:** 앱 셸·폼은 **shadcn/ui**, 랜딩·마케팅은 **Aceternity/Magic UI + 블록 라이브러리**.

---

### STEP 2 — 차별화: 디자인 토큰 / 테마로 "우리만의 룩" 입히기

shadcn 기본 색을 그대로 쓰면 "AI로 만든 티"가 난다. **테마 토큰을 바꾸는 1분 작업이 상업성 체감을 가장 크게 바꾼다(가성비 1위).**

| 도구 | 무엇 | 링크 |
|---|---|---|
| **tweakcn** ⭐ | shadcn용 비주얼 노코드 테마 에디터. 색·radius·shadow·타이포 + 라이트/다크 자동, Tailwind v4. **이미지/설명 → 테마 자동 생성**, 코드 즉시 복사 | [tweakcn.com](https://tweakcn.com) / [GitHub](https://github.com/jnsahaj/tweakcn) |
| **ui.jln.dev** | shadcn용 1만+ 테마 프리셋 — 고르기만 | [ui.jln.dev](https://ui.jln.dev) |
| **shadcn Studio** | 단일 색 → 전체 테마 생성 | [shadcnstudio.com/theme-generator](https://shadcnstudio.com/theme-generator) |

**워크플로우:** ① shadcn 설치 → ② tweakcn에서 브랜드 색/폰트로 테마 만들어 `globals.css` 변수 붙여넣기 → ③ 이후 AI가 만드는 모든 컴포넌트가 자동으로 일관된 우리 테마를 따름. (한국 커뮤니티에서도 **"shadcn/ui + tweakcn"**이 정석으로 공유됨.)

**"디자인 시스템 우선"이 "임기응변 생성"을 명확히 이긴다.** 작동 원리는 **토큰 → 컴포넌트 → 페이지**: 토큰 하나 바꾸면 시스템 전체가 갱신. 임기응변은 화면마다 색·간격·폰트가 미묘하게 어긋나는 "드리프트"를 만들어 상업성을 깬다.

실전 순서: (1) 토큰 잠금(색/타이포/spacing 8px grid/radius/shadow) → (2) 핵심 컴포넌트의 variant부터 확정(전체를 한 번에 생성 금지) → (3) 그 위에서 화면 조립.

참고: [Design Systems for the Vibe Coding Era](https://www.designsystemscollective.com/design-systems-for-the-vibe-coding-era-42282e1affef) · [Supernova: 디자인 시스템이 vibe coding 함정을 막는다](https://www.supernova.io/blog/from-prototype-to-product-how-design-systems-prevent-the-vibe-coding-pitfalls)

---

### STEP 3 — 강제: AI에게 디자인 규칙을 "파일로" 박기 (가장 과소평가된 레버)

**"AI가 못생기게 만드는 이유는 규칙이 없어서."** 규칙을 `CLAUDE.md`/`SKILL.md`/`.cursorrules`/토큰 파일로 박아두면 매 생성마다 품질이 일관되게 올라간다.

> 영어권·한국어권이 동시에 도달한 결론:
> "지금 시각적으로 차별화된 제품을 출시하는 사람들은 더 영리하게 프롬프트하는 게 아니다. **코드 한 줄 쓰기 전에 SKILL.md를 에이전트에 로딩해** 모델이 기본값 대신 명시적 제약을 따르게 강제한다."

**무엇을 넣나 — 운영 가능한(operational) 규칙으로:**
- "좋은 폰트, 멋진 색"(❌ 모델에 무의미) → "Fraunces 디스플레이, 8px 리듬, 강조색 1개, 보라색 금지"(✅ 매번 동일 실행)
- 한국 "토스급 UI" 사례의 구체 규칙: 검정은 `#000`이 아니라 `#2A2A2A` · 강조색 1개만 + 나머지는 그레이스케일 · 그림자 opacity 4%("보이면 이미 과함") · 숫자:단위 = 2:1 · 카드 구조를 순차 교차해 단조로움 방지
- **아키텍처(엔진+스킨):** *엔진* = 레이아웃 로직·타이포 비율·컴포넌트 패턴·금지 조합(언어 무관) / *스킨* = 브랜드 색 변수 하나 든 단일 CSS 파일

**바로 쓸 수 있는 리소스(GitHub):**
- [PatrickJS/awesome-cursorrules](https://github.com/PatrickJS/awesome-cursorrules) — 스택별 `.cursorrules` 모음
- [gnurio/refactoring-ui-plugin](https://github.com/gnurio/refactoring-ui-plugin) ⭐ — 『Refactoring UI』 원칙을 10개 디자인-리뷰 스킬로(시각 위계·타이포·색·여백·그림자·대비)
- [LovroPodobnik/refactoring-ui-skill](https://github.com/LovroPodobnik/refactoring-ui-skill) — 같은 원칙의 Claude Code 스킬
- [spencergoldade/cursor-designer](https://github.com/spencergoldade/cursor-designer) — 디자인 우선 Cursor 룰(UX·IA·접근성)
- [spencerpauly/awesome-cursor-skills](https://github.com/spencerpauly/awesome-cursor-skills) — 8px 그리드·컬러 토큰·5상태(state) 강제 스킬

**Anthropic 공식 `<frontend_aesthetics>` 블록** (Claude Code/Artifacts용 핵심, CLAUDE.md에 삽입 권장):
- **Typography:** Inter/Roboto/Arial/시스템 폰트 **금지**. 대신 Fraunces·Playfair·Clash Display·Satoshi·IBM Plex·Space Grotesk 등. **극단적 대비**(100/200 weight vs 800/900), 크기 점프 3배 이상.
- **Color:** CSS 변수로 일관성. "지배색 + 날카로운 강조색" > 소심하게 균등 분포된 팔레트. **흰 배경 + 보라 그라데이션 금지.**
- **Motion:** 흩뿌린 마이크로 인터랙션보다 **`animation-delay`로 스태거된 페이지 로드 1회**가 더 임팩트.
- **Backgrounds:** 단색 도피 금지 — 레이어드 그라데이션·기하 패턴으로 깊이.
- 주의: Claude는 세대를 거듭해도 Space Grotesk 등 흔한 선택으로 수렴하니 "**틀을 벗어나라**"고 명시.

📎 [Prompting for frontend aesthetics — Claude Cookbook (공식, 필독)](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)

> 💡 이 저장소(ProjectAMO)의 `docs/ui-responsive-guidelines.md`가 바로 이 원리(룰 파일로 AI 기본값 통제)의 좋은 예다.

---

### STEP 4 — 검증: 스크린샷 · 접근성 · 반응형 루프 (상업용의 마지막 관문)

**"AI는 눈이 없다."** 코드만 보고는 UI가 깨졌는지 모른다. 라운드트립 검증이 상업용 품질을 닫는다.

| 도구 | 무엇 | 링크 |
|---|---|---|
| **Playwright MCP / CLI** ⭐ | AI가 화면을 **스스로 띄워 스크린샷 → 보고 판단("정렬 깨졌네") → 재수정**. accessibility tree 스냅샷 기반(픽셀 추측 X)이라 a11y에 직결. `@playwright/cli`는 MCP 대비 토큰 ~4배 절감 | [playwright.dev](https://playwright.dev/docs/accessibility-testing) / [playwright-skill](https://github.com/lackeyjb/playwright-skill) |
| **axe-core / @axe-core/playwright** | 접근성 엔진(WCAG 이슈 최대 57% 자동 검출). E2E에 a11y를 얹어 CI 자동 검사 | [axe-core](https://github.com/dequelabs/axe-core) |
| **Chromatic** | Storybook 기반 비주얼 회귀 + 접근성 회귀. PR마다 UI 깨짐 감지 | [chromatic.com](https://www.chromatic.com) |

> 이 환경의 `design:design-critique`, `design:accessibility-review` 스킬을 루프에 넣으면 색 대비·터치 타깃·키보드 내비·스크린리더까지 점검 가능.

참고: [Giving Claude Code eyes — round-trip screenshot testing](https://medium.com/@rotbart/giving-claude-code-eyes-round-trip-screenshot-testing-ce52f7dcc563) · [Building an AI QA engineer (alexop.dev)](https://alexop.dev/posts/building_ai_qa_engineer_claude_code_playwright/)

---

## 3. 프롬프팅 기법 (4단 워크플로우를 돌릴 때)

### 3-1. 레퍼런스 주도 디자인 — 가장 강력한 단일 레버
**"형용사 대신 보여줄 수 있는 것을 줘라."** AI는 볼 수 있는 구조를 복사한다.
1. Dribbble/Awwwards/실제 제품에서 레퍼런스 3~5개 캡처
2. LLM에 주고 `"이 레이아웃을 상세 분석: 섹션·위계·컴포넌트·시각 스타일"`
3. 합성: `"스크린샷1의 내비 + 2의 카드 그리드 + 3의 색 접근을 하나의 디자인 브리프로"`
4. 사용 시 명시: `"이 카드 레이아웃을 써. 색 구성은 무시."`
> "바이브 코딩은 프롬프팅 스킬이 아니라 **큐레이션 스킬**이다."

### 3-2. PROMPT 6요소 (한 화면 = 한 프롬프트)
**P**latform/Device · **R**ole/User · **O**utput(샘플 데이터까지 구체적) · **M**ood/Style(+hex) · **P**atterns/Components(+라이브러리) · **T**echnical(WCAG AA, Tailwind).
- "dashboard"(❌) → "메트릭 카드 4개, 라인차트, 5행 활동 테이블, 잔액 $12,847.32"(✅)
- 플레이스홀더 대신 **진짜 데이터**를 줘야 밀도가 정확.

### 3-3. 명시적 금지(Negative Constraints) + 결정
- "보라 그라데이션 금지, 가운데 히어로 금지, 아이콘 3개 카드 행 금지" — **slop에 이름을 붙이는 게 피하는 가장 빠른 길.**
- "깔끔하고 모던하게"(평균을 돌려줌) → "폰트 최대 2개, 강조색 1개, 카드 그림자 없음"(결정을 돌려줌).

### 3-4. 한 방 생성 금지 → 3-Pass + 반복
- **① Layout(구조) → ② Style(색·타이포) → ③ Polish(인터랙션·hover/disabled/empty 상태)** 로 분리.
- **첫 결과를 받아들이지 마라.** 3번째 생성이 보통 첫 번째보다 훨씬 낫다(90/10 규칙: AI 90% + 사람 폴리시 10%).
- 외부 LLM(기획·구조) ↔ 빌더(코드 실행) 2-엔진: "바깥에서 생각하고, 안에서 빌드하라."

### 3-5. 자동 강제(Enforcement)
금지 클래스(`bg-indigo-600`, `rounded-2xl` 등)가 등장하면 **빌드를 실패시키는 ESLint 규칙**을 둔다.

---

## 4. AI 도구 지형도 (단계별로 갈아끼우기)

상업용 관점에서 도구는 "프로토타입 속도형"과 "프로덕션 코드형"으로 갈린다. **"예뻐 보이는 목업 ≠ 출시 가능"(Technical Cliff)**을 항상 인지할 것.

| 도구 | 가장 잘하는 것 | 약점 |
|---|---|---|
| **v0 (Vercel)** | UI 품질 1위(shadcn/ui+Tailwind), 기존 코드 통합 | 백엔드 약함 |
| **Lovable** | 풀스택 MVP(Supabase), 반복 컨텍스트 유지 최고, 한국어 입력 양호 | 크레딧 소모 빠름, 복잡해지면 품질↓ |
| **Bolt.new** | 인브라우저 초고속 프로토타입 | 15~20 컴포넌트 넘으면 붕괴 |
| **Cursor** | 코드에 가까운 정밀 제어, 프로덕션 작업 | 디자인 기본기는 룰에 의존 |
| **Claude Code** | 프로덕션 프로토타이핑·정밀 리팩토링, MCP·스킬·룰 결합력 최고 | 기본값은 AI slop → 룰 필수 |
| **Figma MCP** | 디자인↔코드 양방향, 토큰 직접 전달 | 복잡 프레임은 토큰 25k 한계 → 프레임 단위로 |
| **21st.dev Magic MCP** | "에디터 안의 v0" — `/ui`로 shadcn 컴포넌트 즉시 생성 | 유료(무료 한도 적음) |
| **Onlook**(오픈소스) | "디자이너용 Cursor" — React 시각 편집 + AI | 셀프호스팅 |
| **tweakcn** | 테마·토큰 비주얼 에디터(이미지→테마) | 테마 전용 |

**컴포넌트 일관성 — 레지스트리를 직접 읽게 하라:**
- **shadcn Registry MCP** (CLI 3.0, 2025.8): 환각 props 제거, 라이브 레지스트리로 일관 생성. **자사 디자인 시스템을 커스텀 레지스트리로 노출** 가능 → AI가 추측 대신 실제 컴포넌트 사용. [공식 문서](https://ui.shadcn.com/docs/registry/mcp)
- **Figma MCP** (2025.6): 스크린샷 해석이 아니라 Figma의 구조화 데이터(토큰 포함)를 직접 전달. [가이드](https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server)

> **추천 분업:** 예쁜 초안은 **v0/Lovable** → 정밀 구현·유지보수는 **Cursor/Claude Code**. "v0로 속도, Cursor+Claude로 정밀."

참고: [AI 프로토타이핑 스택 비교(Anna Arteeva)](https://annaarteeva.medium.com/choosing-your-ai-prototyping-stack-lovable-v0-bolt-replit-cursor-magic-patterns-compared-9a5194f163e9) · [한국 도구 7종 비교(gpters)](https://www.gpters.org/nocode/post/perfect-comparison-7-recommended-QSJwaZUNnOliLF6) · [삼성SDS 바이브코딩 도구 19선](https://www.samsungsds.com/kr/insights/essential-vibe-coding-tools.html)

---

## 5. 디자인 기본기 & "디자인 눈" 빠르게 기르기 (비디자이너용)

**"훌륭한 UI는 재능이 아니라 시스템이다."** — *Refactoring UI*. 판단할 눈이 없으면 좋은 AI 결과도 알아볼 수 없다.

**핵심 원칙(바로 적용):**
- **시각적 위계**는 크기만이 아니라 **굵기(weight)와 색**으로.
- **간격:** 4/8/16/24px 모듈러 스케일만 사용(임의 값 금지). 여백은 넉넉히 준 뒤 줄여라.
- **타이포:** 본문 크기에서 비율을 곱해 헤딩 도출. 본문 한 줄 50~70자.
- **그레이스케일 먼저:** 흑백으로 위계 완성 후 색을 입힌다.
- **여백을 의도적으로 변주:** 관련 요소는 좁게, 섹션 간은 중간, CTA 주변은 넉넉히(AI는 균일 패딩 → 기계적).

**눈 훈련 (빠른 레벨업):**
- **카피워크:** 위대한 UI를 픽셀 단위로 따라 만들기(화가의 명화 모사).
- **스와이프 파일:** Dribbble/Awwwards에서 수집·분류 → 타이포·레이아웃·색으로 분해.
- **커닝 게임 5분** → 어디서나 나쁜 커닝이 보이게 됨.

**디자인 바이블:** [Refactoring UI](https://refactoringui.com/) (Adam Wathan/Steve Schoger). 위 STEP 3의 플러그인들이 이 책을 AI 규칙으로 변환한 것 → **책 + 플러그인 병행이 강력**.

**토스 디자인 시스템(TDS)** — 한국 최고 수준 토큰화 참고: [달리는 기차 바퀴 칠하기 (toss.tech)](https://toss.tech/article/tds-color-system-update)

---

## 6. 추천 콘텐츠 (시간 없으면 이것만)

**유튜브 — 영어권**
1. [Meng To — AI Design Finally Looks Good (It's Not About the Prompt)](https://www.youtube.com/watch?v=cMcg2VC80Ik) — 철학·방향
2. [Meng To — Beautiful Designs with AI in 40 Min (Not Generic Slop)](https://www.youtube.com/watch?v=NhHfI47WQDM) — 전 과정 실습
3. [Meng To on Lenny — 10x more out of Lovable/Cursor/v0](https://www.youtube.com/watch?v=xcIziZ3-tr4) — 툴별 프롬프트
4. [DESIGN in v0, FINISH in Cursor](https://www.youtube.com/watch?v=i3jqeSbh9WA) — 실전 워크플로우
5. **Refactoring UI / Steve Schoger**, **Kevin Powell**(CSS·시각 완성도) 채널

**유튜브 — 한국어**
1. [클로드 디자인+코드로 움직이는 고퀄 홈페이지 만들기](https://www.youtube.com/watch?v=vHmJg8VQW5c) — 이 주제에 가장 직접적
2. [조코딩 채널](https://www.youtube.com/@jocoding) — 바이브코딩 1인 창업 전 과정
3. [혼자 공부하는 바이브코딩 with 클로드코드(재생목록)](https://www.youtube.com/playlist?list=PLVsNizTWUw7HQ7avxRw301eget4G3sbjw)
4. **Claude Code 디자인 스킬** — UI UX Pro Max / Taste Skill (한국어권 최신 화제: 영어권의 "레퍼런스+토큰+반복"을 스킬로 자동화한 형태)

**필독 글**
- [Prompting for frontend aesthetics — Claude Cookbook (공식)](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)
- [Why Your AI Keeps Building the Same Purple Gradient Website](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website)
- [How to fix the 'AI-generated' look (dev.to/alanwest)](https://dev.to/alanwest/how-to-fix-the-ai-generated-look-in-your-frontend-1ahh)
- [The Vibe-Coder's Prompting Guide (Anna Arteeva)](https://annaarteeva.medium.com/the-vibe-coders-prompting-guide-e04ba0295a18)
- [디자이너 없이 바이브코딩으로 토스급 UI 만드는 법 (dev.to, 한국어)](https://dev.to/kiwibreaksme/dijaineo-eobsi-baibeukodingeuro-toseugeub-ui-mandeuneun-beob-5c0g)

**북마크용 인덱스**
- [bytefer/awesome-shadcn-ui](https://github.com/bytefer/awesome-shadcn-ui) — shadcn 생태계 종합 지도(테마·블록·AI·QA 도구 한곳)

---

## 7. 실행 체크리스트 (그대로 따라 하기)

```
STEP 0 — 룰북 세팅(1회)
  □ CLAUDE.md/.cursorrules에 Anthropic <frontend_aesthetics> 블록 삽입
  □ 금지 목록(Inter·Roboto·보라 그라데이션·가운데 히어로) 명시
  □ 표준 선언: WCAG AA · Tailwind · shadcn/ui
  □ (선택) gnurio/refactoring-ui-plugin 설치

STEP 1 — 디자인 시스템 우선(토큰 잠금)
  □ tweakcn에서 레퍼런스 이미지/브랜드로 테마 생성 → globals.css 변수 적용
  □ 색/타이포/spacing(8px)/radius/shadow를 마크다운 토큰으로 고정 → 모든 프롬프트에 첨부

STEP 2 — 컴포넌트 먼저, 페이지는 조립
  □ shadcn/ui 설치 (앱 셸·폼)
  □ 핵심 컴포넌트의 variant/state(hover·disabled·empty·loading)부터 확정
  □ (선택) 자사 컴포넌트를 shadcn 커스텀 레지스트리 + MCP로 노출

STEP 3 — 화면 생성(속도)
  □ v0/Lovable에서 화면당 1프롬프트 + PROMPT 6요소 + 진짜 데이터
  □ 레퍼런스 3~5개 첨부("make it look like Linear")
  □ 3-Pass: Layout → Style → Polish, 최소 3회 반복(첫 결과 거부)
  □ 랜딩/마케팅은 Aceternity/Magic UI + 블록 라이브러리로 와우 모먼트

STEP 4 — 정밀화(프로덕션)
  □ Cursor/Claude Code로 가져와 토큰·컴포넌트 정합성 + 백엔드 + 반응형 정리

STEP 5 — 검증 루프(눈 달기)
  □ Playwright MCP/CLI 스크린샷 라운드트립 + accessibility tree a11y 점검
  □ axe-core 접근성, design-critique/accessibility-review 스킬로 마감
  □ 통과할 때까지 STEP 3~5 반복

STEP 6 — Technical Cliff 경계
  □ "예쁜 목업 ≠ 출시 가능". auth/DB/테스트 별도 검증 후 고객 대면 배포
```

---

## 부록 — 메타 원칙 (모든 트랙의 공통 마무리)

> "최고의 AI 생성 디자인은 **디자이너가 AI를 도구로 쓸 때** 나온다. AI에게 취향을 발명하라고 시킬 때가 아니다. **인간이 제약과 판단을, AI가 속도와 실행을** 제공한다."

프론트엔드 개발자의 역할은 *구현자 → 아키텍트, 코더 → 취향 결정자(taste-maker)*로 이동한다. 그래서 STEP 3(룰)과 STEP 5(검증)가 진짜 차별화 지점이고, 그걸 받쳐주는 건 STEP 5의 디자인 눈이다.

---

*본 보고서는 4개 병렬 리서치 트랙(GitHub / 커뮤니티 / YouTube / AI 워크플로우)을 통합한 것이다. 각 트랙은 독립적으로 조사되었고, 4단 골격(컴포넌트 토대 → 토큰 차별화 → 룰 강제 → 검증 루프)으로 수렴했다는 점이 핵심 신뢰 신호다.*
