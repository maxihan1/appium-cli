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

## 3. 실기기 E2E (사용자 폰 필요)
- 막힘: Devicefarm(127.0.0.1:4723)은 `POST /api/devices/<serial>/hold` 로 잡은 폰에서만 session 을 연다. 공용 폰이라 임의로 잡지 않았다. apk 경로도 test_platform DB 에 없다
- [ ] open → snapshot → tap → 두 번째 화면 snapshot → generate-locator → close

- [x] `skill/SKILL.md`

## 4. test_platform 연동
- [ ] GitHub 저장소 만들고 push (저장소 이름 필요)
- [ ] test_platform devDependency · `.claude/skills/appium-cli/` · `references/app.md` · docker-compose env · spec · wbs
