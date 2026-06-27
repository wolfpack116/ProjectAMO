import { webLightTheme, webDarkTheme } from '@fluentui/react-components'

// 앱 공용 Fluent 테마 — Fluent 기본값 위에 Pretendard를 입힘.
// 헌법: docs/design/design-language.md §0 (Pretendard, 하이브리드).
export const PRETENDARD_STACK = 'Pretendard, system-ui, sans-serif'

export const appLightTheme = {
  ...webLightTheme,
  fontFamilyBase: PRETENDARD_STACK,
  fontFamilyNumeric: PRETENDARD_STACK,
}

export const appDarkTheme = {
  ...webDarkTheme,
  fontFamilyBase: PRETENDARD_STACK,
  fontFamilyNumeric: PRETENDARD_STACK,
}
