# appium-cli 작업 노트

## 2026-10-20 결정
- **전체 fork 대신 얇은 CLI.** appium-mcp 의 무게(fastmcp · 내장 UiAutomator2/XCUITest driver · iOS 시뮬레이터/WDA 준비 · telemetry)는 원격 Appium 에 붙는 구조에선 쓸 데가 없다. iOS 는 `src/platform/ios.ts` 하나(capabilities · XML 파서 · locator 순위)로 추가한다. 그때 appium-mcp `src/locators` 의 iOS 순위를 가져온다(Apache-2.0, NOTICE 에 표기).
- **daemon 없음.** Appium 서버가 session 을 들고 있으므로 CLI 는 `.appium-cli/<이름>.json` 에 sessionId · ref 표만 적고 매 명령을 W3C HTTP 로 보낸다. 의존성 0.
- **연결 주소는 파일에 적지 않는다.** URL 안 계정이 디스크에 남지 않게 매 명령에서 `--url` 또는 `PLATFORM_APPIUM_URL` 을 읽는다.
- **화면 글 형식은 test_platform runner `화면을줄인다` 와 같다** (+ 줄 끝 `[ref=eN]`). 작성 AI 가 이미 이 형식을 읽는다.
- **locator 는 `~desc` → `id=` 만.** 둘 다 없으면 좌표 tap 은 하되 코드는 내지 않는다(test_platform `tpx-author/references/app.md` §2 — `text=` 금지).
- **액션 뒤 자동 snapshot.** playwright-cli 처럼 액션마다 새 화면 파일 경로를 준다. 화면이 바뀌면 이전 ref 는 버린다.
- **NOTICE 는 아직 없다.** v1 코드는 appium-mcp 가 아니라 test_platform 의 `화면을줄인다` · `appium주소` 를 옮긴 것이다. appium-mcp 코드를 실제로 가져오는 날(iOS) 표기를 붙인다.
- **겹치는 선택자.** 같은 `~desc` 가 화면에 여럿이면 선택자로 누르면 첫 번째가 눌린다. 그 ref 의 좌표를 누르고 코드는 내지 않는다(케이스에 `.nth()` 를 안 쓰는 규칙과 같은 뜻).
- **newCommandTimeout 300초.** 기본 60초면 AI 가 생각하는 사이 session 이 끊긴다.

## 2026-10-20 디바이스 팜 (Devicefarm `docs/guides/test-platform.md` · test_platform 러너 §5.2 「디바이스 팜 접속 방식」)
- 주소는 `http://127.0.0.1:4723/wd/hub`(도커 안은 `host.docker.internal`). 지금 팜은 이 맥 안에서만 열려 인증이 없다. 폰은 R3CR10TCVCD 한 대.
- **폰을 먼저 잡아야 session 이 열린다** — `POST /api/devices/{serial}/hold {"minutes":30|60|120}`, 놓기 `DELETE …/hold`. 놓을 때 깐 앱 · 앱 데이터 · 클립보드를 정리한다. 그래서 공용 폰을 에이전트가 임의로 잡지 않았다.
- 인증을 켜면 `Authorization: Bearer pat_…`. WebdriverIO `user` · `key`(= URL 안 계정 → Basic)는 명령이 401 이다 → CLI-F2-01.
- 앱은 URL 로 넘긴다(받는 쪽이 팜 PC). 같은 맥이면 파일 경로도 통했다(test_platform 실측).
- test_platform `APP-F1-11` 은 「appium-mcp 로」라고 적혀 있다. CLI 로 바꾼 것은 test_platform 진행판에서 그쪽이 적는다(연동은 그쪽 몫 — 2026-10-20 사용자).
- 작업은 `docs/wbs.md` 를 진행판으로 쓴다. `checklist.md` 의 3 · 4 절은 WBS 로 옮겼다.
- **토큰 환경값은 `PLATFORM_APPIUM_TOKEN`** (CLI-F2-01). test_platform `APP-F1-10` 이 아직이라 `PLATFORM_APPIUM_URL` 짝으로 이 이름을 정했다 — kit 이 다른 이름을 고르면 CLI 를 맞춘다. 토큰이 있으면 URL 안 계정(Basic)은 버린다.
- **hold · release · devices** (CLI-F2-02). 잡기 주소는 Appium 주소에서 `/wd/hub` 를 뗀 곳. 잡은 폰 serial 은 `.appium-cli/held` 에 적어 `release` 가 `--udid` 없이 놓게 한다. `close` 는 폰을 놓지 않는다 — 팜은 놓을 때 깐 앱을 지워서, 탐색 중 session 을 다시 열 때마다 앱이 지워지면 안 된다. 실제 팜 `devices` 응답 확인(R3CR10TCVCD IDLE).
