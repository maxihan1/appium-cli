# WBS — appium-cli 포팅

> **진행판 원본이다.** 형식은 test_platform `docs/wbs.md` 와 같다 — 영역 · 기능 · 태스크, 체크박스만.
> **범위는 CLI 저장소 안뿐이다.** test_platform 연동 · 작성 에이전트 작업은 test_platform 진행판(`APP-F1-11`)에서 한다.
> **태스크 하나 = 세션 하나.** 한 세션(1~2시간)에 끝나고 commit 하나로 닫히는 크기다. 넘치면 쪼개 새 번호를 준다.
> **체크는 근거가 있을 때만 찍는다.** 다음 줄에 `  - 근거 <commit> · YYYY-MM-DD`. 순번은 재사용하지 않는다.
> 결정과 까닭은 `context-notes.md`, 계획 원본은 `~/.claude/plans/appium-mcp-test-platform-nifty-pie.md`.

**차례** CLI-F2-01 → F2-02 → F2-03 → F3-01 → F4-01 → F5-01 → F5-02 → F5-03 → F5-04 → F5-05 → F5-06.

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
- [x] `CLI-F3-01` 실기기 E2E — `hold` → MDA apk `open` → 로그인 뒤 두 번째 화면까지 `tap` · `fill` → 두 번째 화면 요소에 `generate-locator` · 그 요소를 선택자 경로(`Ran: await driver.$(…)`)로 `tap` 성공 → `close` · `release`. 실측해서 `context-notes.md` 에 적을 것: 팜이 `newCommandTimeout` 300 을 받는지(팜 기본 60초) · 액션 뒤 화면이 전환 중에 찍히는지 · 화면 파일 크기. 나온 작은 고칠 것은 이 태스크에서 고친다 (사용자: apk 경로 · 폰이 비어 있을 것)
  - 근거 commit 60541c4 · 2026-10-20 (팜 폰 R3CR10TCVCD · MDA — 결과는 context-notes.md)

### ④ 내보내기
**무엇** 다른 저장소가 설치 명령 하나로 받게 GitHub 저장소로.
- [x] `CLI-F4-01` GitHub 저장소 · push · 태그 `v0.1.0` · README 한 쪽(설치 · 루프 · 연결 표). `npm i github:maxihan1/appium-cli#v0.1.0` 이 `prepare` 로 빌드되는지를 맥과 `node:22` 컨테이너 둘에서 실측 (사용자: 저장소 이름)
  - 근거 commit 11a5074 · 태그 v0.1.0 · 2026-10-20 (private — 받는 쪽 git 에 인증 필요, context-notes.md)

### ⑤ 앱 크롤러 — test_platform `scripts/authoring-crawl*.ts` 의 앱판
**무엇** 앱을 스스로 눌러 가며 화면마다 구조 · 화면 연결 · API 호출을 파일로 남긴다. 웹은 `goto(주소)` 로 아무 화면에나 돌아가지만 앱은 주소가 없다 — `back` · 앱 재시작 + 경로 다시 누르기로 돌아간다. 그래서 같은 시간에 보는 장수가 웹보다 적다(어림 10분 30~50장 — F5-05 에서 잰다).
API 는 logcat 으로 본다 — QA 는 debug 빌드라 네트워크 로그가 남는다(2026-10-20 사용자 「프로덕션에서만 CD로 없앤다」). 웹 크롤러의 화면 크기 판정 · HTTP 상태 멈추기 · 내려받기 거르기는 앱에 없다.
- [x] `CLI-F5-01` `logs` 명령 — Appium `POST /session/{id}/se/log {type:"logcat"}` 의 새 줄만(첫 호출은 쌓인 줄을 버린다) · `--grep <식>` · `--api` 면 API 줄만 `METHOD URL` 로(기본 꼴 OkHttp `--> GET https://…`, `--api-pattern` 으로 바꾼다) · 물음표 뒤는 지운다(토큰 · 검색어). 앱 줄 거르기는 꼴로만 한다(PID 는 팜 Appium 에 `adb_shell` 이 없어 못 묻는다). **케이스 ↔ API 용으로** `apis` 명령도 낸다 — `--session-id <id>`(남이 연 session, 예: kit 케이스의 `appium-session` 번호)에 붙어 읽거나 `--file <logcat.txt>`(팜이 session 마다 남기는 파일)를 읽어 `[{method, url, at}]` JSON. 시각(`at`)이 있어야 test_platform 이 단계에 나눈다. 테스트: 가짜 logcat 으로 새 줄 · API 꼴 · 물음표 지움 · 파일 입력
  - 근거 commit f69d642 · 2026-10-20
- [x] `CLI-F5-02` `crawl` 뼈대 — 시작 화면에서 누를 후보(클릭 가능 + desc · id · 글자 중 하나)를 모아 하나씩 누른다 → 화면이 바뀌면 새 화면인지 가린다. **화면 키 = `app:<activity>/<화면 이름표>`** — 화면 이름표는 본문 컨테이너의 desc · resource-id(MDA 실측: `desc="login screen"` · `"products screen"` · `"api calls screen"`), 없으면 구조 지문(글자 · 숫자를 뺀 짜임). 이 키가 test_platform `screen_record.url` 칸에 그대로 들어간다(웹의 같은 틀 `/board` 자리 — 칸이 TEXT 라 표는 안 바뀐다). 다음 실행에도 같은 화면이면 같은 키여야 저장본 · 지도가 이어진다 → 기록 → `back` 으로 돌아와 앞 화면 키와 견준다, 못 돌아오면 앱 재시작(`mobile: terminateApp` · `activateApp`) + 경로 다시 누르기. 다른 앱이 뜨면 `back`. 상한: `--max` 장 · `--minutes` · 화면당 누름 30 · 동작 간격. 테스트: 가짜 Appium 으로 화면 셋 그래프를 돈다
  - 근거 commit 7ea6507 · 2026-10-20
- [x] `CLI-F5-03` 안 누를 것 · 확인 창 — test_platform `authoring-crawl-press.ts` · `-rules.ts` 의 위험 글자(로그아웃 · 탈퇴 · 삭제 · 결제 …) · 탈퇴 흐름 화면에서는 아무것도 안 누르기 · 되돌릴 수 없음 경고 · 확인 버튼 고르기를 옮긴다(글자 판정만 — 주소 낱말 판정은 앱에 없다). Android 확인 창(`android:id/alertTitle` · `button1` · `button2`)과 앱 안 모달. `--exclude <글자 식>`. 로그인 풀림 = 아이디 칸 + 비밀번호 칸이 같이 뜬 화면. 테스트: 판정 표
  - 근거 commit f168376 · 2026-10-20
- [x] `CLI-F5-04` 결과 파일 · 저장본 — test_platform 화면 기록 통로(`PUT …/screens`, `apps/admin/src/prd/screens.ts` 화면검사)가 그대로 받는 칸으로 낸다: 상태 `로그아웃` · `로그인:<역할>` · `url`(=화면 키) · `name` · `textFp` · `structFp`(16진 64자 이하) · `record` · `links[{toUrl, via}]` · `apis[{method, url}]`. 파일은 test_platform 크롤러 출력 꼴을 따른다: 화면마다 파일(머리에 입력칸 줄 + 구조) · `index.json` · `list.json` · `links.json`(화면 → 화면, `버튼 「이름」`) · `apis.json`(화면마다 F5-01 로 모은 API) · `summary.json`. `--keep <저장본>` 이면 지문 · 글자지문으로 같음 · 바뀜 · 새 화면 · 못 본 화면. 요약 한 줄은 웹 크롤러 꼴. 테스트: 출력 모양 · 저장본 견주기
  - 근거 commit 9c94caf · 2026-10-20
- [ ] `CLI-F5-06` 라이브러리로 내보내기 · `screen` 명령 — test_platform kit · 러너 · 스캐너가 CLI 를 띄우지 않고 부르게 `package.json` `exports` 로 `screenKey(xml)`(F5-02 와 같은 규칙) · `parseSource` · `apiLines(logcat)`(F5-01 과 같은 규칙)을 낸다. `screen` 명령은 지금 화면 키 · 이름을 낸다 — 작성 AI 가 앱 화면 파일에 화면 주소 값으로 적는다(**케이스 ↔ 화면** 의 재료). README · SKILL.md 에 쓰는 법. 테스트: 내보낸 함수가 CLI 와 같은 값을 내는지
- [ ] `CLI-F5-05` 로그인 상태 · 실기기 — 로그아웃 상태를 먼저 돌고, `--login <스크립트>`(appium-cli 명령 묶음)로 로그인해 다시 돈다. 풀리면 앱 데이터 지우기(`mobile: clearApp`) 뒤 다시 로그인 — 세 번까지. 실기기: 팜 폰 + MDA 로 로그아웃 · 로그인 두 상태를 돌아 장수 · 시간 · 링크 수를 `context-notes.md` 에 적는다. API 줄은 debug apk 가 있으면 함께 본다 (사용자: debug apk — 없으면 API 만 빼고 닫는다)

---

## 지금 안 하는 것
- iOS — `src/platform/ios.ts`(capabilities · XCUITest 화면 파서 · `~name` → `-ios predicate` 순위) 하나로 붙인다. appium-mcp `src/locators` 를 가져오면 NOTICE 를 단다. 팜에 iOS 폰이 생긴 뒤
- `hold/extend` — 탐색 한 번은 30분 안에 끝난다. 크롤이 길어지는 실측이 나오면 붙인다
- test_platform 쪽에서 해야 지도가 다 이어지는 것 (DB 표는 그대로 — 2026-10-20 실제 DB 확인)
  - 케이스 ↔ 화면(`case_screen.screen_url`): 앱 화면 파일(page object)이 화면 키(`app:…`, CLI `screen` 명령으로 얻는다)를 화면 주소 값으로 적고 스캐너가 읽어야 한다. 지금 앱 케이스(`tests/mda`)는 화면 파일이 없다. 실행 중 지나간 화면을 모으는 길은 안 맞는다 — `case_screen` PK 가 `(tc_id, file)` 이라 화면 파일이 있어야 한다
  - 케이스 ↔ API(`service_api_use` 케이스 줄): 웹은 실행 trace 에서 채우는데 android 실행은 trace 가 없다(`traceIngest.ts` android 건너뜀). kit fixture 가 session 을 닫기 전에 `apiLines` 로 읽거나 러너가 닫은 뒤 팜 `logcat.txt` 를 받아 `apis --file` 로 — 시각으로 단계에 나눠 넣는다. logcat 버퍼는 10,000줄 상한(실측)이라 긴 케이스는 `appium:logcatFilterSpecs` 로 네트워크 줄만 받는 것을 권한다(미실측)
  - API 가 지도에 들려면 앱 API 호스트가 그 대상 서버 `base_url` 과 같은 사이트이거나 `project_api_server` 에 있어야 한다
  - 크롤 결과를 화면 기록 통로로 올리는 것은 작성 에이전트 몫
  - 화면 파일 머리 `# app:…` 받기 — test_platform `기록주소()` 가 `# https?://` 만 받아 앱 화면 파일이 `이번것들` · `받은저장본` 에서 빠진다(CLI-F5-04 에서 확인)
