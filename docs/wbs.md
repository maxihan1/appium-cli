# WBS — appium-cli 포팅

> **진행판 원본이다.** 형식은 test_platform `docs/wbs.md` 와 같다 — 영역 · 기능 · 태스크, 체크박스만.
> **범위는 CLI 저장소 안뿐이다.** test_platform 연동 · 작성 에이전트 작업은 test_platform 진행판(`APP-F1-11`)에서 한다.
> **태스크 하나 = 세션 하나.** 한 세션(1~2시간)에 끝나고 commit 하나로 닫히는 크기다. 넘치면 쪼개 새 번호를 준다.
> **체크는 근거가 있을 때만 찍는다.** 다음 줄에 `  - 근거 <commit> · YYYY-MM-DD`. 순번은 재사용하지 않는다.
> 결정과 까닭은 `context-notes.md`, 계획 원본은 `~/.claude/plans/appium-mcp-test-platform-nifty-pie.md`.

**차례** CLI-F2-01 → F2-02 → F2-03 → F3-01 → F4-01.

---

## CLI — appium-cli 저장소 (`~/Projects/Appium_cli`)

### ① 뼈대
**무엇** 웹의 playwright-cli 와 같은 snapshot → ref → 액션 루프를 앱에. daemon 없이 Appium session 번호만 파일에 둔다.
- [x] `CLI-F1-01` v0.1 — open · snapshot · find · tap · fill · swipe · back · screenshot · generate-locator · close · list · 액션마다 `Ran:` 코드 + 새 화면 · `~desc` → `id=` 만 · 에이전트 지침 `skill/SKILL.md` · 테스트 18
  - 근거 commit f146bb1 · 2026-10-20

### ② 디바이스 팜에 붙기
**무엇** Devicefarm(`docs/guides/test-platform.md`)이 요구하는 세 가지 — 토큰 머리 · 폰 잡기 · 기기 고르기.
- [x] `CLI-F2-01` 토큰 머리 — `--token` · 환경값 → `Authorization: Bearer <pat_…>`. URL 안 계정 → Basic 은 로컬 Appium 용으로 남긴다. 둘 다 오면 토큰이 앞선다. 환경값 이름은 test_platform `APP-F1-10`(kit 토큰 머리)과 맞춘다. 테스트: 헤더 · 우선순위
  - 근거 commit 2035098 · 2026-10-20
- [x] `CLI-F2-02` 폰 잡기 · 놓기 — `hold [--minutes 30|60|120]` · `release` · `devices`(빈 폰 목록). 대상 폰은 `--udid` · `PLATFORM_DEVICE_UDID`, 없으면 `devices` 의 빈 폰 하나. 팜 주소는 Appium 주소에서 `/wd/hub` 를 뗀 것. 409 `refused` 는 이유를 그대로 낸다. `close` 는 폰을 놓지 않는다(사람이 이어 쓸 수 있다) — SKILL.md 에 「hold 했으면 release」 를 적는다. 테스트: fetch 가짜로 요청 순서 · 409
  - 근거 commit 4ecac90 · 2026-10-20
- [x] `CLI-F2-03` 기기 고르기 · 앱 URL — `--filter` → capabilities `farm:filter`(`os>=13,model=SM-*`). `--app` 은 경로 · URL 둘 다 그대로 넘긴다(팜은 URL — 받는 쪽이 팜 PC). SKILL.md 연결 표 갱신
  - 근거 commit 0ae5763 · 2026-10-20

### ③ 실기기 확인
**무엇** 가짜 fetch 가 아니라 이 맥 팜의 폰(R3CR10TCVCD)으로 끝까지 한 번.
- [ ] `CLI-F3-01` 실기기 E2E — `hold` → MDA apk `open` → 로그인 뒤 두 번째 화면까지 `tap` · `fill` → 두 번째 화면 요소에 `generate-locator` · 그 요소를 선택자 경로(`Ran: await driver.$(…)`)로 `tap` 성공 → `close` · `release`. 실측해서 `context-notes.md` 에 적을 것: 팜이 `newCommandTimeout` 300 을 받는지(팜 기본 60초) · 액션 뒤 화면이 전환 중에 찍히는지 · 화면 파일 크기. 나온 작은 고칠 것은 이 태스크에서 고친다 (사용자: apk 경로 · 폰이 비어 있을 것)

### ④ 내보내기
**무엇** 다른 저장소가 설치 명령 하나로 받게 GitHub 저장소로.
- [ ] `CLI-F4-01` GitHub 저장소 · push · 태그 `v0.1.0` · README 한 쪽(설치 · 루프 · 연결 표). `npm i github:<계정>/appium-cli#v0.1.0` 이 `prepare` 로 빌드되는지를 맥과 `node:22` 컨테이너 둘에서 실측 (사용자: 저장소 이름)

---

## 지금 안 하는 것
- iOS — `src/platform/ios.ts`(capabilities · XCUITest 화면 파서 · `~name` → `-ios predicate` 순위) 하나로 붙인다. appium-mcp `src/locators` 를 가져오면 NOTICE 를 단다. 팜에 iOS 폰이 생긴 뒤
- `hold/extend` — 탐색 한 번은 30분 안에 끝난다. 길어지는 실측이 나오면 붙인다
