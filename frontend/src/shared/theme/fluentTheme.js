import { webLightTheme, webDarkTheme } from '@fluentui/react-components'

// 앱 공용 Fluent 테마 — Fluent를 헌법 토큰(글꼴·강조색·의미색)에 연결.
// 글꼴: --app-font(설정 토글이 Fluent까지 일괄 변경). 강조: --accent(slate, MS 블루 대체).
// 의미: --level-*. 헌법: docs/design/design-language.md §0/§5.
export const APP_FONT_STACK = 'var(--app-font, system-ui, sans-serif)'

const A = 'var(--accent)'
const darker = (p) => `color-mix(in srgb, var(--accent) ${p}%, #000)`
const tintBg1 = (p) => `color-mix(in srgb, var(--accent) ${p}%, var(--bg-1))`

// 헌법 토큰을 Fluent 토큰에 매핑 (Fluent 값은 CSS 변수 문자열도 허용 → 런타임에 해석).
const bridge = {
  fontFamilyBase: APP_FONT_STACK,
  fontFamilyNumeric: APP_FONT_STACK,
  // brand(강조) = slate accent
  colorBrandBackground: A,
  colorBrandBackgroundHover: darker(88),
  colorBrandBackgroundPressed: darker(76),
  colorBrandBackgroundSelected: darker(88),
  colorCompoundBrandBackground: A,
  colorCompoundBrandBackgroundHover: darker(88),
  colorCompoundBrandBackgroundPressed: darker(76),
  colorBrandForeground1: A,
  colorBrandForeground2: darker(88),
  colorBrandForegroundLink: A,
  colorBrandForegroundLinkHover: darker(88),
  colorBrandForegroundLinkPressed: darker(76),
  colorBrandStroke1: A,
  colorBrandStroke2: tintBg1(40),
  colorCompoundBrandStroke: A,
  colorCompoundBrandStrokeHover: darker(88),
  colorNeutralForegroundOnBrand: '#fff',
  // status(의미) = level
  colorStatusSuccessForeground1: 'var(--level-green)',
  colorStatusSuccessBackground3: 'var(--level-green)',
  colorStatusSuccessBackground1: 'var(--level-green-bg)',
  colorStatusWarningForeground1: 'var(--level-amber)',
  colorStatusWarningBackground3: 'var(--level-amber)',
  colorStatusWarningBackground1: 'var(--level-amber-bg)',
  colorStatusDangerForeground1: 'var(--level-red)',
  colorStatusDangerBackground3: 'var(--level-red)',
  colorStatusDangerBackground1: 'var(--level-red-bg)',
}

export const appLightTheme = { ...webLightTheme, ...bridge }
export const appDarkTheme = { ...webDarkTheme, ...bridge }
