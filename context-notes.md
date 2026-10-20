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
- **`--filter` → `farm:filter`** (CLI-F2-03). `--app` 은 경로든 URL 이든 그대로 넘긴다 — test_platform runner 는 `://` 를 400 으로 막지만(러너 PC 가 아무 apk 나 받지 않게), CLI 는 사람이나 작성 AI 가 직접 쓰는 도구이고 팜은 URL 을 요구한다.

## 2026-10-20 실기기 E2E (CLI-F3-01) — 팜 폰 R3CR10TCVCD · MDA(saucelabs my-demo-app-rn v1.3.0, test_platform SETUP.md §15 의 연습 앱)
- 흐름: devices → hold 30 → open(앱 설치 포함 11.4초) → tap `~open menu` → tap `~menu item log in` → fill `~Username input field` · `~Password input field` → tap `~Login button` → 로그인 뒤 화면에서 tap `~sort button` → `~nameDesc` → swipe up → back → screenshot → close → release → 폰 IDLE.
- **newCommandTimeout 300 을 팜이 받는다.** 75초 아무 명령 없이 둔 뒤 snapshot 이 됐다(팜 기본 60초면 끊겼을 것).
- **액션 뒤 화면이 늦게 바뀐다.** 로그인 버튼 0.5초 뒤 자동 snapshot 이 앞 화면(로그인)이었다 — 그 ref 로 누르면 엉뚱한 요소다. 고침: 화면이 앞과 달라지고 연속 두 번 같을 때까지 300ms 간격으로 다시 읽는다(최대 3초). 고친 뒤 정렬 창이 바로 찍혔다. 안 바뀌는 액션은 3초를 다 쓴다.
- 액션 하나 약 2초(가라앉기 포함). 화면 파일은 5~7KB(요소 25~70개) — Appium 원본 XML 의 1/10 아래.
- `find --regex` 에 `(?i)` 를 넣었다가 JS 정규식이 거절했다 → playwright-cli 처럼 `/식/i` 를 받게 했다.
- 확인 못 한 것: 주소 없는 입력칸의 좌표 fill(element/active) — MDA 입력칸은 모두 desc 가 있었다.
- 팜 쪽 실측: `/wd/hub/session` · `/api/devices/{serial}/hold` 모두 문서대로였다. W3C `element` · `click` · `value` · `actions` 아닌 `mobile: swipeGesture` · `back` · `screenshot` 도 팜을 거쳐 됐다.

## 2026-10-20 내보내기 (CLI-F4-01)
- 저장소 `github.com/maxihan1/appium-cli` **private** (사용자). 태그 `v0.1.0`.
- 설치 실측: 맥 `npm i -D github:maxihan1/appium-cli#v0.1.0` 59초 · `node:22` 컨테이너 26초 — 둘 다 `prepare` 가 빌드하고 `npx appium-cli help` 가 돈다. 패키지에는 `dist` · `skill` · `README` 만 담긴다.
- **private 이라 받는 쪽 git 에 GitHub 인증이 있어야 한다.** 컨테이너에서는 토큰을 `git config url."https://x-access-token:<토큰>@github.com/".insteadOf` 로 `ssh://git@github.com/` · `git@github.com:` · `https://github.com/` 세 꼴에 걸었다. test_platform Docker 빌드에 넣을 때 그쪽이 정할 일이다(빌드 인자 · secret mount — 토큰을 이미지 층에 남기지 않는다).
- 설치가 느린 것(수십 초)은 `prepare` 가 vitest · typescript 를 받아서다. 느려서 문제가 되면 `dist` 를 태그에 싣는 쪽으로 바꾼다.

## 2026-10-20 앱 크롤러 · API 로그
- test_platform 크롤러(7파일)를 기능별로 견줬다. 그대로 되는 것: 구조 · 위험 글자 · 확인 창 · 상한 · 지문 · 저장본 · 화면 연결 · 로그인 풀림. 바꿔야 되는 것: 이동(goto → 누르기 + back · 재시작) · 화면 구분(URL 틀 → activity + 구조 지문) · 제외(경로 → 글자 식) · 역할 로그인(상태 파일 → 앱 데이터 지우기 + 로그인 다시). 없는 것: 화면 크기 판정 · HTTP 상태 · 내려받기.
- **API 는 logcat.** 실측: 팜을 거쳐 Appium `se/log {type:"logcat"}` 가 된다(첫 호출 10,000줄, 그 뒤 새 줄만). MDA(release)는 `api calls` 화면에서 404 호출이 났는데(화면에 Not found) 앱 줄 7개가 다 터치였다 — API 0줄.
  사용자: QA 는 debug 빌드를 쓰고 운영에서만 CD 로 로그를 뺀다 → logcat 길로 간다. 프록시(mitmproxy)는 인증서 신뢰 설정 · 폰 프록시가 무거워 안 한다.
- 앱 PID 로 거르지 못한다 — 팜 Appium 에 `--allow-insecure=uiautomator2:adb_shell` 이 없다. API 줄 꼴(OkHttp `--> GET …`)로만 거른다.
- **지도 · DB (2026-10-20 실제 DB 조회).** 지도 표는 `screen_record`(PK service_id · env · state · url) · `screen_link`(from_url · to_url · via) · `screen_found` · `case_screen`(tc_id · file · screen_url) · `req_case` · `service_api` · `service_api_use`(케이스 줄 또는 화면 줄, 화면 줄은 screen_record 로 FK). url 은 전부 TEXT 이고 지금 값은 경로(`/board`). 상태는 `로그아웃` · `로그인:<역할>` CHECK. 플랫폼 · 엔진 칸은 없다.
  → 앱 화면 키 `app:<activity>/<화면 이름표>` 를 url 칸에 넣으면 표를 안 바꾸고 화면 · 화면 연결 · 화면 ↔ API 가 들어간다. 케이스 ↔ 화면 · 케이스 ↔ API 는 test_platform 작업(앱 화면 파일 · 실행 중 logcat)이 있어야 잇는다.
