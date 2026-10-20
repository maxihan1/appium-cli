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

## 2026-10-20 logs · apis (CLI-F5-01)
- **첫 `logs` 는 쌓인 줄을 버리고 session 파일에 `logcat읽음` 을 적는다.** 그 뒤 새 줄만 주는 것은 Appium 이 session 마다 읽은 자리를 기억해서다(CLI 는 자리를 안 든다). 그래서 open 뒤 · 볼 동작 전에 `logs` 를 한 번 불러 기준을 잡아야 한다 — 크롤러(F5-02)도 시작할 때 한 번 버리고, 누름마다 `logs` 로 그 사이 API 를 모은다. 시각으로 자르지 않은 까닭: Appium 항목 `timestamp` 는 팜 PC 가 줄을 받은 시각이라(쌓인 줄도 session 시작 시각) CLI 시계와 견줄 수 없다.
- 같은 session 의 se/log 를 다른 누군가(kit · `apis --session-id`)가 부르면 그 줄은 이쪽에 다시 오지 않는다 — 한 session 에 읽는 쪽은 하나.
- `apis --session-id` 는 쌓인 줄도 버리지 않는다(케이스 전체가 필요하다). `at` 은 줄 머리의 logcat 시각 글(`10-20 10:07:55.318`) — 연도가 없다. 팜 `logcat.txt` 가 정말 줄마다 이 꼴인지는 미실측(가짜 파일로만 시험).
- `--api-pattern` 은 모임이 둘 아니면 Appium 을 부르기 전에 던진다 — 읽은 줄은 다시 안 오니까. `--api-pattern` 만 줘도 `--api` 로 본다.
- `apiLines(lines, pattern?)` 는 `src/logcat.ts` 에 있다(F5-06 이 내보낸다). 실기기 확인은 안 했다 — 폰을 잡아야 해서.

## 2026-10-20 crawl 뼈대 (CLI-F5-02)
- 결과 `.appium-cli/crawl.json` = `{ app, screens: [{key, name, structFp, path}], links: [{from, to, via: "버튼 「이름」"}], presses, restarts, stopped }`. F5-04 가 test_platform 꼴 파일로 바꾼다. `--max` 에 닿아 멈추면 남기지 않은 화면으로 가는 link 가 하나 남을 수 있다.
- 화면 키 = `app:<activity>/<본문 컨테이너>` — 누르지 못하는 요소 중 desc 가 있는 가장 큰 것 → 앱 resource-id(`android:` 뺌)가 있는 가장 큰 것 → 없으면 구조 지문. name 은 그 안 첫 TextView 글자.
- 후보 = 누를 수 있고 이름(desc → id → 글자)이 있는 요소, 같은 이름은 앞 것만. 하나뿐인 선택자면 선택자로, 아니면 가운데 좌표.
- 누른 뒤 앱 · 키 · structFp 중 하나라도 바뀌면 back. 다음 누르기 전에 목표 화면이 아니면 terminateApp · activateApp 뒤 path(후보 이름 차례)를 다시 누른다 — 크롤은 **앱 첫 화면에서 시작**해야 재시작이 같은 곳으로 온다.
- 안 누를 것 hook 은 `src/crawl.ts` `누를까()` — 탐색과 경로 다시 누르기 둘 다 `후보들` 을 거친다. F5-03 전에는 위험 버튼도 누른다(README · SKILL 에 경고).
- 확인 못 한 것(F5-05 실기기): MDA 컨테이너가 clickable=false 인지 · 글자를 자식 TextView 에만 가진 버튼(이름이 비어 후보에서 빠짐) · fragment 앱의 같은 nav_host id(키가 뭉칠 수 있음, `ponytail:` 주석).
- 전체 테스트가 한 번 exit 137 로 죽었다(PC 종료 직후). 다시 돌리니 44개 통과 — 일시적이었다.

## 2026-10-20 안 누를 것 · 확인 창 (CLI-F5-03)
- 판정은 `src/press.ts`(test_platform `authoring-crawl-press.ts` · `-rules.ts` 의 글자 판정만 — 주소 낱말 판정은 앱에 없다). `후보들(h, 뺄)` 이 거르니 탐색과 경로 다시 누르기가 같은 후보를 본다.
- **위험 글자 버튼은 안 누른다.** 웹 크롤러는 버튼이면 위험 이름도 누르고 확인 창으로 막지만, 앱 버튼은 창 없이 바로 지우거나 결제할 수 있다. 12자 이하 이름만 본다(긴 글은 본문) — resource-id 이름(`pkg:id/…`)은 글이 아니라 길이를 안 보고, 꾸러미를 떼고 `_` · `-` 를 띄어 본다(`btn_log_out` → 로그아웃).
- **로그아웃은 늘 안 누른다**(길이 무관). F5-05 가 로그인 판에서 다시 로그인할 수 있을 때만 누르게 바꾼다 — test_platform `누를까` 의 `상태 !== '로그아웃' && 다시로그인` 자리. 지금은 `안누를까닭()` 의 '로그아웃' 갈래.
- **탈퇴 이름은 누른다**(test_platform 과 같다 — 탈퇴 화면도 지도에 남긴다). 탈퇴말이 위험 글자보다 앞서서 「회원 탈퇴」 · 「Delete my account」 는 눌린다. 그 이름으로 뜬 확인 창은 글과 상관없이 안 누르고(back), 그 이름으로 간 새 화면 · 이름(첫 TextView)이나 키에 탈퇴가 든 화면은 `탈퇴흐름: true` 로 남기고 아무것도 안 누른다(대기에서 건너뛴다). 「해지」 는 계정 · 회원이 붙을 때만 탈퇴 — 「구독 해지」 는 위험 글자로 안 누른다.
- **확인 창 = `android:id/button1|2|3` 이 있는 화면**(framework · AppCompat AlertDialog 둘 다 버튼 id 가 같다. AppCompat 제목은 `<pkg>:id/alertTitle` 이라 제목으로는 안 본다). UiAutomator2 source 는 창이 뜨면 그 창의 window 만 주는 것으로 보고 화면 전체 글로 판정한다 — 아래 화면 글이 섞여 탈퇴 · 경고로 잘못 가려도 back 쪽이라 안전하다. 버튼은 id 거꾸로(button3 · 2 · 1) 세워 `확인버튼고르기`(취소 · 닫기 아닌 마지막) — 보통 button1. 탈퇴 · 경고 · 입력칸 · 누를 버튼 없음(남음)은 back. 결과는 `crawl.json` `dialogs: {누름, 탈퇴, 경고, 입력, 남음}` 셈(경로 다시 누르기 중 창은 처리만 하고 안 센다). 확인 창 처리는 링크 · 새 화면 판정보다 먼저라 창 자체는 화면으로 안 남는다.
- **앱 안 모달(RN Modal 등)은 따로 안 가린다** — 버튼 id 가 앱마다 달라 싸게 못 가린다. 지금처럼 구조가 바뀐 누르기로 보고 back 으로 닫는다(F5-02 규칙). 실기기에서 모달이 새 화면으로 남으면 그때 판정을 붙인다.
- **로그인 풀림 = 비밀번호 칸(`password="true"`) + 비밀번호 아닌 EditText · AutoCompleteTextView** → 화면에 `로그인풀림: true`. 요소에 `비밀번호` 칸을 더했다(글자는 여전히 안 싣는다). 아무 동작도 안 한다 — 로그아웃 판에서는 로그인 화면이 그냥 이렇게 표시된다. F5-05 가 로그인 판에서 이 표시로 다시 로그인한다(test_platform 처럼 로그인 판에서만 풀림으로 본다).
- **자식 글자는 안 본다.** 이름은 요소 자신의 desc → id → 글자만. 글자를 자식 TextView 에만 가진 버튼은 F5-02 처럼 후보에서 빠진다(F5-05 실기기에서 많으면 그때).
- `--exclude` 는 여러 번 받고 cli 의 `정규식()`(`/식/i`)으로 바꿔 crawl 에 RegExp[] 로 넘긴다 — 옮길 필요가 없었다. 후보 이름(desc → id → 글자)에 맞춘다.
- 확인 못 한 것: 실기기 AlertDialog source 모양(창만 오는지) · 확인 창 버튼 누르기 실패는 2154487 에서 back 으로 닫고 이어 가게 고쳤다.

## 2026-10-20 결과 파일 · 저장본 (CLI-F5-04)
- **`crawl.json` 은 없앴다.** `--out <폴더>`(기본 `.appium-cli/crawl/`)에 test_platform 크롤러 꼴로 쓴다 — 칸 이름은 그쪽 `남기기` 그대로, 화면 키가 `주소` · `틀` 두 자리에 든다. 원자료(path · 탈퇴흐름 · 로그인풀림 · dialogs · presses · restarts)는 `index.json` 이 옛 crawl.json 모양 그대로 받고 화면마다 `상태` · `파일` · `textFp` 를 더했다(화면 글은 화면 파일에만).
  - `로그아웃/NNN.yml` — 글은 YAML 이 아니지만 test_platform `이번것들` 이 `NNN.yml` 로 기록 번호를 맞춰서 확장자를 맞췄다. `# <화면 키>` · `# 입력칸: text|password <desc → id>[ · 읽기 전용]`(`칸줄` 꼴 — 필수 · 글자 수 · 형식은 Android 화면 글에 없다, hint 도 parseSource 가 안 읽는다) · `parseSource().글`. 요소에 `꺼짐`(enabled=false)을 더했다.
  - `list.json` `[{주소, 이름, 상태, 파일, 틀, 지문, 글자지문, 저장본?, 저장기록?}]` · `links.json` `[{상태, 틀, 연결:[{to, via}]}]`(연결 있는 화면만, 같은 to+via 하나로) · `apis.json` `[{상태, 틀, api:[{method, url}]}]`(화면마다, 빈 것도 — test_platform 과 같다) · `summary.json` `{멈춘까닭, 상태들, 예외}`(웹 전용 `따라가기` 는 뺐다).
  - `textFp` = test_platform `글자지문`(화면 파일 전체, `#` 줄 밖 숫자는 0 — 좌표 · ref 번호가 흔들려도 같다), `structFp` = 기존 `지문`. 둘 다 12자 16진.
- **상태는 `결과파일들(r, 상태, 저장, 오늘)` 의 인자다.** cli 가 지금 `'로그아웃'` 을 넘긴다. 상태 폴더는 `로그아웃` · `로그인`(test_platform `폴더이름`), 번호는 그 실행 안 차례. F5-05 가 두 판을 한 폴더에 쓰려면: 번호를 판을 이어 매기고(test_platform 은 전체 `판.본.length+1`), `목록고르기`(로그아웃 · 로그인에 다 있는 틀은 로그인 쪽만, 시작 화면은 둘 다 — 단 앱은 로그아웃 판에서도 `로그인풀림` 을 표시하니 그것으로 목록에서 빼는 것은 로그인 판만) · `연결모으기`(로그아웃 연결을 그 틀의 로그인 화면에 합치기)를 옮겨야 한다. 지금은 안 옮겼다(상태가 하나라 아무 일도 안 한다).
- **API 는 화면마다.** crawl 시작에 logcat 을 한 번 읽어 버리고(못 읽는 서버면 API 없이 돈다 — 크롤은 안 멈춘다), 누르기 바로 전에 읽은 줄은 지금 화면(목표) 몫(back · 재시작 + 경로 다시 누르기로 오며 찍힌 것), 누른 뒤(확인 창 처리까지) 읽은 줄은 간 화면 몫 — 안 바뀌었거나 다른 앱이면 누른 화면 몫. test_platform 웹은 누르기 API 를 **누른 화면** 에 넣지만 여기는 사용자 지시대로 간 화면이다. 화면당 200개 · 같은 method+url 하나. `at` 은 버린다. `--api-pattern` 이 crawl 에도 흐른다. 시작 화면이 처음 뜰 때의 API 는 쌓인 줄과 함께 버려진다(앱 재시작 뒤 다시 찍히면 들어간다). 누름마다 se/log 를 두 번 부른다.
- **`--keep`** 은 test_platform `저장본모양` 그대로(`{판:1, 항목:[{키:"<상태> <틀>", 상태, 틀, 주소, 지문, 글자지문, 기록:"out-<12hex>.md", 훑은날}]}`) — 에이전트가 화면 기록에서 만든 `kept/index.json` 을 그대로 넘기면 된다. 없거나 틀린 파일은 「저장본 없음」(test_platform 과 같다 — 2MB 상한은 안 옮겼다). `견주기` 는 글자지문 + 30일, 번호 틀(`:n`) 갈래는 뺐다.
- **도중에 죽어도 본 것까지는 남긴다.** crawl 이 루프 안 오류를 `예외` 로 싣고 돌려주면 cli 가 파일을 쓴 뒤 던진다 → `summary.json` `예외: true` · `상태들: []`(에이전트가 못 본 화면을 안 지운다).
- 요약 줄: `크롤: 로그아웃 N장 · 연결 · API · 누름 · 재시작 · 확인 창 · 저장본 … · 멈춘 까닭 · 초 · <out>/list.json`.
- test_platform 쪽에서 볼 것(이 저장소 밖): `기록주소()` 가 `# https?://` 만 받아 `# app:…` 머리의 화면 파일은 `이번것들` · `받은저장본` 에서 빠진다 — 앱 크롤 결과를 올리려면 그쪽이 `app:` 도 받아야 한다. `--out` 폴더는 이전 실행의 남은 `NNN.yml` 을 지우지 않는다(list.json 이 기준).
- 확인 못 한 것: 실기기 logcat API 배정(debug apk — F5-05), 화면 파일 크기(구조 상한 40,000자는 안 옮겼다 — 앱 화면 5~7KB 실측).

## 2026-10-20 라이브러리 · screen (CLI-F5-06)
- **입구는 `src/index.ts` 하나 — `screenKey` · `parseSource` · `apiLines` 셋만 낸다**(테스트가 `Object.keys` 로 지킨다). 공개 이름은 영어(다른 저장소가 부른다), 안쪽 이름은 그대로. `package.json` `exports["."]` = `{types: ./dist/index.d.ts, default: ./dist/index.js}`, bin 은 그대로. `tsconfig.build.json` `declaration: true` — d.ts 는 모든 파일에 나오고 index.d.ts 가 `./crawl.js` 의 `화면정보` 를 가리킨다(타입은 따로 안 냈다 — `ReturnType<typeof screenKey>` 로 쓴다). `exports` 를 두면 `appium-cli/dist/…` 깊은 import 는 막힌다.
- `screenKey(xml, activity)` 는 `화면을가린다(parseSource(xml), activity)` 한 줄 — 규칙을 옮기지 않았다. activity 는 Appium `current_activity` 값 그대로(`.Main` 꼴). 기본 API 꼴 상수(`기본API꼴`)는 안 냈다 — `apiLines` 둘째 인자를 비우면 그것이다.
- **`screen` 은 crawl 의 `본다()`(이제 export)를 그대로 부른다** — source · current_activity · current_package 를 읽고 키는 crawl 이 남기는 값과 같다. 출력은 `<키> · <이름>`, 이름이 없으면 키만. 화면 파일 · ref 표는 안 바꾼다(읽기만). `--raw`/JSON 은 안 붙였다.
- 꾸러미 확인: `npm pack` tgz 를 빈 폴더에 깔아 `import('appium-cli')` → `[apiLines, parseSource, screenKey]`, `tsc --moduleResolution nodenext --skipLibCheck false` 로 타입도 통과. GitHub 설치(`github:…#tag`)는 새 태그가 있어야 받는다 — 태그는 주인이 정한다(이번엔 안 만들었다).
- 확인 못 한 것: 실기기 `screen`(폰을 안 잡았다) · test_platform 쪽 실제 import(그쪽 작업).

## 2026-10-20 로그인 상태 · 실기기 (CLI-F5-05) — 팜 폰 R3CR10TCVCD · MDA v1.3.0 release
- **`crawl --login <스크립트>` 의 스크립트 = `appium-cli -s=<이름>` 뒤에 쓰는 명령을 한 줄에 하나.** 따옴표로 띄어쓰기를 묶고(`fill '~Username input field' bob@example.com`) 빈 줄 · `#` 줄은 건너뛴다. 받는 명령은 `tap` · `click` · `fill` · `back` · `swipe` 뿐이고 `tap` · `fill` 은 선택자만(ref 는 화면마다 바뀐다) — 틀리면 Appium 을 부르기 전에 던진다. 줄마다 `run()` 을 그대로 부르니 가라앉기 · 코드 규칙이 사람이 친 것과 같다. 끝나면 앱 첫 화면이어야 한다(재시작 뒤 거기서 경로를 누른다). MDA 는 로그인하면 products screen 으로 가서 맞았다.
- **tap · fill 이 ref 대신 `~desc` · `id=…` 를 받는다.** 마지막 화면을 안 보고 지금 앱에서 찾고, 못 찾으면 `가라앉기.찾기_ms`(10초) 동안 다시 찾는다 — clearApp 뒤 앱이 처음 뜨는 데 몇 초 걸린다. 겹치는 선택자면 첫 번째가 눌린다(Appium 규칙).
- **판 = test_platform 상태.** 로그아웃 판을 돈 뒤 `mobile: clearApp`(막히면 `terminateApp`) → `activateApp` → 스크립트 → `로그인:<역할>` 판. 역할 기본은 test_platform `기본역할`(`@platform/kit/accounts` = `일반 회원`), `--role` 로 바꾼다(`상태인가` 꼴로 먼저 본다). 장수 · 마감은 test_platform 몫과 같이 나눈다(`(남은 장) / (남은 판)`, 마감 `시작 + (i+1)·분/판수`). 멈춘 까닭은 첫 것만(`??=`) — 여러 판이면 `로그아웃 몫 · --minutes 12` 꼴. 로그인하며 찍힌 logcat 은 버린다.
- **크롤 결과 하나에 판을 다 싣는다**(test_platform `판` 처럼). 화면 · 연결에 `상태` 칸, 같은 키 판정 · API 배정은 판 안에서. `index.json` 에 `상태들`(끝까지 돈 판 — summary 도 이것) · `다시로그인` · `앱비우기`. `결과파일들(r, 저장, 오늘)` 이 번호를 판을 이어 매기고(`로그아웃/001…` 다음 `로그인/014…`) `목록고르기`(로그인 판 로그인풀림 빼고, 로그인 판에도 있는 키의 로그아웃 화면 빼고, 시작 화면은 둘 다) · `연결모으기`(빠진 로그아웃 화면의 연결 · API 를 같은 키의 로그인 화면에 합침)를 옮겼다.
- **다시 로그인 (test_platform 과 같은 뜻).** 로그인 판에서 누른 뒤 로그인 화면이면 앱을 비우고 다시 로그인한 뒤 같은 버튼을 한 번 더 누른다 — 또 로그인 화면이면 로그인 칸이 있는 화면으로 남기고(로그인풀림, 목록에서 빠짐) 안 돈다. 로그아웃 이름은 다시 로그인할 수 있을 때만 후보가 되고(`후보들(h, 뺄, 로그아웃누름)`), 누르면 그 뒤 화면은 안 남기고(연결은 남김) 다시 로그인한다. 판마다 세 번까지 — 다 쓰면 로그아웃은 후보에서 빠지고, 로그인 화면이 또 뜨면 `로그인이 풀림` 으로 그 판을 멈춘다. 처음 로그인은 세지 않는다. 스크립트 뒤에도 로그인 화면이면 던진다(로그아웃 판까지는 남는다).
- **실측 (마지막 실행, `--max 40 --minutes 12`).** open 8.4초. 로그아웃 판 13장 · 로그인 판 12장 · 목록 14장(로그아웃은 시작 화면 · login screen 만 남는다) · 연결 46개(links.json 은 합쳐 36개) · 누름 66번 · 재시작 47번 · 확인 창 26번(모두 확인 누름) · 다시 로그인 2번 · 725초. 두 판 다 6분 몫 시간에 닿았다 — 장수 상한(20)은 안 닿았다. 누름 하나에 약 11초(재시작 + 경로 다시 누르기가 대부분). 화면 파일은 6.8KB 아래.
  - 다시 로그인 둘: `menu item log out`(확인 창 → 로그인 화면 → 다시 로그인) 하나, `menu item log in` 이 로그인 판에서도 로그인 화면을 띄운 것 하나(다시 누르니 cart screen 으로 갔다 — 첫 누름은 링크를 안 남겨 index 에는 다시 누른 결과만 있다).
  - **`mobile: clearApp` 이 팜에서 됐다** — 세 번(처음 + 다시 둘) 다 `앱비우기: mobile: clearApp`, 그 뒤 로그인 스크립트가 10초 기다림 안에 돌았다.
  - **화면 키는 두 판 · 두 실행에서 같았다** — products screen · cart screen · product screen · webview selection screen · drawing screen · about screen · biometrics screen · api calls screen · SauceBot screen 은 컨테이너 desc, 서랍 메뉴는 `menu item webview`(아래), 정렬 창은 `active option`(체크 표시의 desc — 이름은 약하지만 늘 있다), 리뷰 감사 창은 구조 지문 `387b3554fc5f`(세 실행 같음).
  - 못 본 것: QR · 위치(권한 창 = 다른 앱이라 back) · 상품 담기 → 결제(시간 안에 못 감 — 그래서 로그인해야만 보이는 화면은 이번엔 없었다). MDA 가 앱 재시작 뒤에도 로그인을 들고 있는지는 못 가렸다(두 판 화면이 같다).
  - **API 는 안 쟀다** — MDA release 빌드라 네트워크 로그가 없다(API 0개). debug apk 가 없어 WBS 대로 API 만 빼고 닫는다.
- **실기기에서 고친 것 (모두 테스트 붙임).**
  1. *키 뭉침 — 서랍 메뉴.* 첫 실행은 로그아웃 4장 · 로그인 4장뿐이었다. 서랍이 열려도 products screen 이 트리에 그대로 있어 메뉴 키가 products screen 이 되고(구조만 바뀐 누르기로 보고 back) 메뉴 아래를 못 갔다. → `요소.깊이`(XML 깊이)를 더하고, 컨테이너 자손이 아닌데 가운데가 컨테이너 안에 든 요소(덮개)가 있으면 덮개의 첫 누를 것(desc → id)을 이름표로 쓴다. 덮개를 품는 바탕(전체 화면 backdrop · content)은 뺀다. MDA 서랍은 `menu item catalog` 가 컨테이너 위쪽이라 `menu item webview` 가 이름표다 — 어느 화면에서 열어도 같다. `ponytail:` 컨테이너와 겹치는 떠 있는 버튼도 덮개로 본다.
  2. *자식 글자만 가진 버튼.* 상품 칸이 이름 없는 clickable ViewGroup 이라 후보가 아니었다(F5-02 · 03 에서 미뤘던 것). → 이름이 없으면 자손의 첫 desc · 글자로 부른다. 상품 여섯이 다 `store item text` 라 하나만 누른다 — product screen 이 생겼다.
  3. *버튼 칸이 빈 확인 창.* 둘째 실행에서 「App State has been reset.」 · 로그아웃 뒤 창이 버튼 없이(`android:id/buttonPanel` 이 빔) 와서 화면으로 남고, 구조 지문이 같아 서로 다른 창이 `aa9d6298fe97` 한 키로 뭉쳤다. → `android:id/alertTitle` · `parentPanel` 이 있으면 버튼이 없어도 창(`남음` → back).
  4. *이어 뜨는 창.* 확인 뒤 「됐다」 창이 또 뜬다(MDA 초기화 · 로그아웃). → 창 닫기를 세 번까지 되풀이한다.
  셋째 실행에서 뭉친 창 화면은 없어졌다(그 실행은 버튼이 다 와서 `남음` 갈래는 단위 테스트로만 확인).
- 재시작이 누름의 70% 다 — 서랍 메뉴 항목이 간 화면에서 back 하면 서랍이 아니라 products 로 돌아가서다. 장수를 늘리려면 back 뒤 화면이 경로의 중간 화면이면 그 뒤만 누르는 쪽(경로 줄이기)이 다음 손볼 곳이다. 지금은 안 한다.

## 2026-10-20 open --cap (CLI-F6-01)
- **`--cap 키=값` 은 첫 `=` 에서 가르고, 값을 `JSON.parse` 해 되면 그 값 · 안 되면 글 그대로.** `true` · `5` · `["OkHttp:D","*:S"]` 는 JSON, `--es server http://host:3002` 는 글. 글 `5` 를 굳이 실으려면 `'x="5"'`.
- **`--cap` 이 기본값을 덮는다** — `{ ...capabilities(), ...더 }`. `appium:app` · `platformName` 도 덮을 수 있지만 막지 않았다(막을 까닭이 뚜렷한 건 빈 키 · `=` 없음뿐 — 둘 다 Appium 을 부르기 전에 던진다). 파싱은 `cli.ts` `캡읽기` — `capabilities()` 시그니처는 그대로(라이브러리 입구가 아니다).
- 확인 못 한 것: 실제 Appium 이 `optionalIntentArguments` · `logcatFilterSpecs` 를 받는지(폰을 안 잡았다 — F6-05 에서).

## 2026-10-20 팜 산출물 (CLI-F6-02)
- **실측 답은 `{value: {sessionId, ready, files: [{name, bytes, url}], errors}}`** — `value` 로 싸여 왔다(`부른다` 가 싸든 안 싸든 벗긴다). `files[].url` 은 팜 원점 기준 경로(`/wd/hub/api/sessions/<id>/artifacts/<name>`)라 `new URL(url, base)` 로 원점에 붙인다(base 에 붙이면 `/wd/hub` 가 겹친다). 원점이 Appium 주소와 다르면 토큰을 안 보내고 던진다. 없는 번호는 404 `no such artifact`(`부른다` 가 까닭을 낸다).
- **목록 길은 Appium 주소 + `/api/sessions/{id}/artifacts`**(문서 길 `/wd/hub/api/…`). CLI 기본 주소(`/wd/hub` 없음)로도 로컬 팜은 200 이었다 — `/wd/hub` 를 떼는 `팜` 연결은 안 썼다.
- **close 가 번호를 `.appium-cli/<이름>.last` 에 적는다**(DELETE 가 실패해도 — 끊긴 session 도 산출물은 있다). `artifacts` 는 번호가 없으면 이것을 읽고, 없으면 「close 를 먼저」 로 던진다. `list` 는 `.json` 만 보니 안 섞인다. 번호는 `[\w-]+` 만(기본 폴더 이름이 된다).
- **ready:false 는 `가라앉기.산출물_ms`(15초) 동안 `산출물간격_ms`(1초)마다 다시 본다** — 테스트는 0. 넘으면 `ready:false` 를 까닭에 붙여 던진다.
- **받기**: 이름(빈 글 · `/` · `\` · `..` 든 것)을 다 먼저 보고 하나라도 틀리면 아무것도 안 받는다. `writeFile(path, res.body)` 로 스트림 저장(바이너리 그대로), 내려받기 상한 10분(`ponytail:`). 받은 크기가 목록 `bytes` 와 다르면 던진다. 출력은 파일마다 `- <name> <bytes> bytes: <path>`, 팜 `errors` 는 `팜 오류: …` 줄(글이 아니면 JSON).
- **라이브러리 입구에 `farmArtifacts(appiumUrl, sessionId, outDir, { token }?)` → `Promise<{ files: [{name, bytes, path}], errors: string[] }>`** 를 더했다(이제 넷 — 테스트가 `Object.keys` 로 지킨다). CLI 와 같은 `산출물을받는다(c, sid, 폴더)` 를 부른다. errors 를 돌려주는 까닭: APP-F1-12 증적에서 영상이 빠진 까닭을 알아야 한다. 타입 `산출물` 은 따로 안 냈다.
- 실측(읽기만, 폰 안 잡음): 팜 `lastSessionId` `9e8923ed…` 를 CLI 와 `farmArtifacts` 로 각각 받았다 — `logcat.txt` 862,058 · `video-1.mp4` 2,223,904 bytes(목록과 같음, `file` = ISO Media MP4, 둘이 같은 바이트), CLI 0.9초. 받은 logcat 을 `apis --file` 에 넣으니 `[]`(MDA release 빌드 — 꼴 확인은 F6-05).
- 확인 못 한 것: 실제 `ready:false` 답(가짜 fetch 로만) · 팜 `errors` 의 실제 꼴 · 인증 켠 팜.
