import { webLightTheme, webDarkTheme } from '@fluentui/react-components'

// 앱 공용 Fluent 테마 — Fluent 기본값 위에 Pretendard GOV(정부표준)를 입힘.
// 헌법: docs/design/design-language.md §0.
export const APP_FONT_STACK = "'Pretendard GOV', system-ui, sans-serif"

export const appLightTheme = {
  ...webLightTheme,
  fontFamilyBase: APP_FONT_STACK,
  fontFamilyNumeric: APP_FONT_STACK,
}

export const appDarkTheme = {
  ...webDarkTheme,
  fontFamilyBase: APP_FONT_STACK,
  fontFamilyNumeric: APP_FONT_STACK,
}
