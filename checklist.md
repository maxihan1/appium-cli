# appium-cli 체크리스트

계획 원본: `~/.claude/plans/appium-mcp-test-platform-nifty-pie.md`

## 1. 파서 · ref · locator
- [x] `src/platform/android.ts` — capabilities · parseSource(ref 붙인 화면 글) · locatorFor
- [x] `test/android.test.ts` — fixture XML 로 검증 → `npm test`

## 2. CLI
- [x] `src/appium.ts` — W3C 호출 · URL 계정 → Basic 헤더
- [x] `src/cli.ts` — open · snapshot · find · tap · fill · swipe · back · screenshot · generate-locator · close · list
- [x] 액션 뒤 `Ran:` 코드 한 줄 + 자동 snapshot
- [x] `test/cli.test.ts` — fetch 가짜로 tap 흐름 검증
- [x] `npm run typecheck` · `npm run build`

## 3 · 4 → `docs/wbs.md` 로 옮겼다 (CLI-F2-01 부터)
- [x] v0.3.1 — `mobile: startActivity` 를 `intent` 대신 `component` 로(extras 가 버려지던 것) · 테스트 · README
