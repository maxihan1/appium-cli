# WBS — appium-cli 포팅

> **진행판 원본이다.** 형식은 test_platform `docs/wbs.md` 와 같다 — 영역 · 기능 · 태스크, 체크박스만.
> **범위는 CLI 저장소 안뿐이다.** test_platform 연동 · 작성 에이전트 작업은 test_platform 진행판(`APP-F1-11`)에서 한다.
> **태스크 하나 = 세션 하나.** 한 세션(1~2시간)에 끝나고 commit 하나로 닫히는 크기다. 넘치면 쪼개 새 번호를 준다.
> **체크는 근거가 있을 때만 찍는다.** 다음 줄에 `  - 근거 <commit> · YYYY-MM-DD`. 순번은 재사용하지 않는다.
> 결정과 까닭은 `context-notes.md`, 계획 원본은 `~/.claude/plans/appium-mcp-test-platform-nifty-pie.md`.

**차례** CLI-F2-01 → F2-02 → F2-03 → F3-01 → F4-01 → F5-01 → F5-02 → F5-03 → F5-04 → F5-06 → F5-05 → F6-01 → F6-02 → F6-03 → F6-04 → F6-05 → (다음) F6-06 ~ F6-10.

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
- [x] `CLI-F5-06` 라이브러리로 내보내기 · `screen` 명령 — test_platform kit · 러너 · 스캐너가 CLI 를 띄우지 않고 부르게 `package.json` `exports` 로 `screenKey(xml)`(F5-02 와 같은 규칙) · `parseSource` · `apiLines(logcat)`(F5-01 과 같은 규칙)을 낸다. `screen` 명령은 지금 화면 키 · 이름을 낸다 — 작성 AI 가 앱 화면 파일에 화면 주소 값으로 적는다(**케이스 ↔ 화면** 의 재료). README · SKILL.md 에 쓰는 법. 테스트: 내보낸 함수가 CLI 와 같은 값을 내는지
  - 근거 commit 1fe68b7 · 2026-10-20
- [x] `CLI-F5-05` 로그인 상태 · 실기기 — 로그아웃 상태를 먼저 돌고, `--login <스크립트>`(appium-cli 명령 묶음)로 로그인해 다시 돈다. 풀리면 앱 데이터 지우기(`mobile: clearApp`) 뒤 다시 로그인 — 세 번까지. 실기기: 팜 폰 + MDA 로 로그아웃 · 로그인 두 상태를 돌아 장수 · 시간 · 링크 수를 `context-notes.md` 에 적는다. API 줄은 debug apk 가 있으면 함께 본다 (사용자: debug apk — 없으면 API 만 빼고 닫는다)
  - 근거 commit ec0e5ed · 2026-10-20 (팜 폰 · MDA — 결과는 context-notes.md)

### ⑥ 추가 기능 — 2026-10-20 재점검(test_platform 이 웹에서 쓰는 playwright-cli 명령 · 남은 미확인 · test_platform 진행판 APP-F1-11~13)
**무엇** test_platform 에서 앱을 바로 쓰는 데 모자란 것(먼저 F6-01~05)과 크롤 범위 · 편의(다음 F6-06~10).
- [x] `CLI-F6-01` `open --cap key=value`(여러 번) — capabilities 에 그대로 싣는다. 값은 JSON 이면 JSON 으로(`appium:optionalIntentArguments='--es server http://…'` · `appium:autoGrantPermissions=true` · `appium:logcatFilterSpecs=["OkHttp:D","*:S"]`). 팜 · 컨테이너는 `adb reverse` 를 못 쓰니 데모마켓 앱 서버 주소는 이 길로만 준다. 테스트: capabilities 몸 · JSON 값
  - 근거 commit 6112ac1 · 2026-10-20
- [x] `CLI-F6-02` `artifacts [sessionId] [--out 폴더]` — 팜 `GET /wd/hub/api/sessions/{id}/artifacts` 의 `files[].url`(실측: `logcat.txt` · `video-1.mp4` …, 30일 보관)을 내려받는다. sessionId 가 없으면 이 CLI 가 마지막으로 `close` 한 session(close 때 번호를 남긴다). `ready:false` 면 잠깐 기다린다. 라이브러리 입구 `farmArtifacts()` 로도 낸다 — test_platform `APP-F1-12`(증적 영상 · logcat) 가 쓴다. 받은 `logcat.txt` 는 `apis --file` 에 그대로. 테스트: 가짜 fetch 로 목록 · 내려받기 · 마지막 session
  - 근거 commit 0523323 · 2026-10-20
- [x] `CLI-F6-03` `attrs <ref>` — 그 요소의 원래 XML 속성 전부(hint · password · focusable · checkable · long-clickable · scrollable · selected · bounds …). 웹 작성 AI 가 `eval` 로 입력칸 최대 글자 · 필수 · 형식을 읽어 경계값 케이스를 만드는 자리(test_platform `tpx-cases/references/4-selector.md`). snapshot 은 줄인 글이라 ref 표에 원래 속성을 함께 둔다. 비밀번호 칸 text 는 여기서도 싣지 않는다. 테스트: 속성 · 비밀번호 가림
  - 근거 commit 9a01bb8 · 2026-10-20
- [x] `CLI-F6-04` crawl `--out` 정리 (결함) — 시작할 때 상태 폴더(`로그아웃/` · `로그인/`)와 결과 json 을 지운다. 지금은 이전 실행의 `NNN.yml` 이 남아 test_platform 이 폴더를 훑으면 지난 화면이 섞인다. `--out` 이 작업 트리 · 홈처럼 위험한 곳이면 거절(test_platform 크롤러와 같다). 테스트: 남은 파일이 지워지는지 · 위험 경로 거절
  - 근거 commit 1f55510 · 2026-10-20
- [x] `CLI-F6-05` 실기기 확인 2 — 데모마켓 debug 앱(`~/Projects/demo-market/android`, 요소마다 resource-id · content-desc 같은 이름, `optionalIntentArguments` 로 서버 주소)으로: 팜 `logcat.txt` 꼴과 `apis --file` · 좌표 fill(element/active) · 실기기 `screen` · `attrs` 로 hint · 최대 글자가 나오는지 · `artifacts` 영상 · crawl 화면별 API 배정. API 배정은 데모마켓 `Api.kt` `call()` 에 `Log.d("OkHttp", "--> $method ${base + path}")` 한 줄이 있어야 한다 (사용자: 데모마켓 수정 허락 — 없으면 API 만 빼고 닫는다). 폰은 hold → … → close · release → IDLE 확인
  - 근거 commit a9fa305 · 2026-10-20 (팜 폰 · 데모마켓 debug — 결과는 context-notes.md)
  - 실측: `--cap` 받음(서버 닿음) · Compose id 는 `appium:disableIdLocatorAutocompletion=true` 가 있어야 `id=` 로 찾힌다(고침: 까닭 알림 · crawl 좌표 대체) · `attrs` 에 hint · 최대 글자 없음(EditText 29속성) · 팜 logcat.txt 24,222줄 전부 threadtime 시각 머리(헤더 2줄 빼고) · `apis --file` [] · 합성 OkHttp 줄 2개 뽑힘 · artifacts 5.2초(logcat 4.0MB · 영상 3개 22.8MB) · 좌표 fill CLI 갈래는 미확인(입력칸 id 가 다 하나뿐 — curl 로 element/active 첫 칸 1초 지연 확인 → 다시 묻기로 고침) · crawl 로그인 화면 1장 · 로그인 판은 clearApp 이 서버 주소를 지워 못 돎 · API 배정 건너뜀(Api.kt 수정 허락 없음) · 폰 IDLE
- [x] `CLI-F6-06` crawl 스크롤 — 화면 후보를 다 누른 뒤 스크롤 가능한 요소가 있으면 위로 밀어 새 후보를 모은다(같은 후보가 다시 보이면 끝 · 화면당 상한). 경로 다시 누르기에 스크롤도 기록한다. 데모마켓 상품 목록 「더 불러오기」
  - 근거 commit e94c2fe · 2026-10-20 (가짜 앱 테스트만 — 실기기는 F6-07 과 함께)
- [x] `CLI-F6-07` crawl 재시작 줄이기 — 실측 누름의 약 70% 가 재시작(F5-05). back 이 엉뚱한 화면으로 가면 그 화면에서 목표까지 아는 가장 짧은 경로를 먼저 시도하고, 안 될 때만 재시작. 같은 시간에 장수 · 깊이가 느는지 MDA 로 잰다
  - 근거 commit 4893609 · 2026-10-20 (팜 폰 · MDA — 결과는 context-notes.md)
  - 실측(로그아웃 판 6분): 13장 · 누름 43 · 재시작 17(40%, F5-05 71%) · 지름길 10(못 닿음 0) · 누름 하나 약 8.5초(F5-05 약 11초) · 장수 · 깊이(2걸음)는 F5-05 로그아웃 몫과 같음 · 남은 재시작은 시작 화면 back → 앱 밖으로 짐작(미확인) · MDA path 에 `↓` 없음(되풀이 이름 목록)
- [x] `CLI-F6-08` `fill --submit` · `hide-keyboard` — playwright-cli `fill --submit` 처럼 입력 뒤 IME 동작(`mobile: performEditorAction`)을 보낸다. 키보드가 아래 버튼을 가리면 `hide-keyboard`
  - 근거 commit d10d266 · 2026-10-20 (실기기 미확인 — 팜 꺼짐)
- [x] `CLI-F6-09` `attach <sessionId>` — 남이 연 session(kit 케이스)에 CLI session 파일만 만들어 붙는다. test_platform 이 웹에서 실패한 케이스를 `playwright cli attach` 로 디버깅하는 자리(`tpx-cases/references/6-gates.md`). close 는 그 session 을 닫지 않고 파일만 지운다(남의 session)
  - 근거 commit b947071 · 2026-10-20 (실기기 미확인 — 팜 꺼짐)
- [ ] `CLI-F6-10` `app restart` · `app clear` · `record start|stop` — crawl 안에만 있는 재시작 · 데이터 지우기를 명령으로. record 는 팜이 아닌 로컬 Appium 용(팜은 F6-02)

---

## 지금 안 하는 것
- iOS — `src/platform/ios.ts`(capabilities · XCUITest 화면 파서 · `~name` → `-ios predicate` 순위) 하나로 붙인다. appium-mcp `src/locators` 를 가져오면 NOTICE 를 단다. 팜에 iOS 폰이 생긴 뒤
- `hold/extend` — 탐색 한 번은 30분 안에 끝난다. 크롤이 길어지는 실측이 나오면 붙인다
- test_platform 쪽에서 해야 지도가 다 이어지는 것 (DB 표는 그대로 — 2026-10-20 실제 DB 확인)
  - 케이스 ↔ 화면(`case_screen.screen_url`): 앱 화면 파일(page object)이 화면 키(`app:…`, CLI `screen` 명령으로 얻는다)를 화면 주소 값으로 적고 스캐너가 읽어야 한다. 지금 앱 케이스(`tests/mda`)는 화면 파일이 없다. 실행 중 지나간 화면을 모으는 길은 안 맞는다 — `case_screen` PK 가 `(tc_id, file)` 이라 화면 파일이 있어야 한다
  - 케이스 ↔ API(`service_api_use` 케이스 줄): 웹은 실행 trace 에서 채우는데 android 실행은 trace 가 없다(`traceIngest.ts` android 건너뜀). kit fixture 가 session 을 닫기 전에 `apiLines` 로 읽거나 러너가 닫은 뒤 팜 `logcat.txt` 를 받아 `apis --file` 로 — 시각으로 단계에 나눠 넣는다. logcat 버퍼는 10,000줄 상한(실측)이라 긴 케이스는 `appium:logcatFilterSpecs` 로 네트워크 줄만 받는 것을 권한다(미실측)
  - API 가 지도에 들려면 앱 API 호스트가 그 대상 서버 `base_url` 과 같은 사이트이거나 `project_api_server` 에 있어야 한다
  - 크롤 결과를 화면 기록 통로로 올리는 것은 작성 에이전트 몫
  - 진행판 `APP-F1-11` 문구 「appium-mcp 로」 → appium-cli · `APP-F1-13` 토큰 환경값 이름을 CLI `PLATFORM_APPIUM_TOKEN` 과 맞추기
  - 화면 파일 머리 `# app:…` 받기 — test_platform `기록주소()` 가 `# https?://` 만 받아 앱 화면 파일이 `이번것들` · `받은저장본` 에서 빠진다(CLI-F5-04 에서 확인)
