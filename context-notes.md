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
- test_platform 쪽에서 볼 것(이 저장소 밖): `기록주소()` 가 `# https?://` 만 받아 `# app:…` 머리의 화면 파일은 `이번것들` · `받은저장본` 에서 빠진다 — 앱 크롤 결과를 올리려면 그쪽이 `app:` 도 받아야 한다. `--out` 폴더의 이전 실행 `NNN.yml` 은 F6-04 부터 시작할 때 지운다(아래 F6-04).
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

## 2026-10-20 attrs (CLI-F6-03)
- **ref 표의 요소에 `속성: Record<string,string>`(풀어 쓴 값)을 더했다** — parseSource 가 남기는 요소의 태그 속성 전부. 버린 껍데기 요소 · hierarchy 는 안 싣고 XML 통째로도 안 둔다. 비밀번호 칸(`password="true"`)은 `text` 키를 뺀다(빈 값이 아니라 없음 — `password=true` 줄이 보인다). snapshot 글은 한 글자도 안 바뀌었다(기존 테스트 그대로 통과). 라이브러리 `parseSource().refs` 에도 같이 나온다(더하기만).
- **출력은 `키=값` 한 줄에 하나** — `class` · `resource-id` · `content-desc` · `text` · `hint`(있는 것만) 다음 나머지는 알파벳 차례(`sort()` — 키가 ASCII). 값 안 줄바꿈은 `\n` 두 글자로 적어 한 줄에 하나를 지킨다. 따옴표 · JSON 은 안 쓴다(값이 비면 `content-desc=`). `--raw` 는 없다. 없는 ref 는 `고른다()` 를 그대로 써 generate-locator 와 같은 글로 던진다. Appium 은 안 부른다(마지막 화면 ref 표만 본다).
- 속성 이름은 Appium 이 준 그대로(`class` 는 전체 이름 `android.widget.EditText`, 줄인 `cls` 와 다르다). 없는 속성을 지어내지 않는다 — hint · 최대 글자가 page source 에 있으면 나올 뿐이다.
- session 파일이 커진다 — 요소마다 속성 20개 안팎(실기기 기준 추정). 70개 화면이면 수십 KB, 들여쓰기 2칸 JSON 그대로 둔다. 이 버전 전에 찍은 session 파일에는 `속성` 이 없다 — snapshot 을 다시 찍으면 생긴다.
- 확인 못 한 것: 실기기 page source 에 `hint` · max length 같은 속성이 실제로 오는지(UiAutomator2 판 · 앱마다 다르다) — F6-05 에서 데모마켓으로 본다. session 파일 실제 크기도 그때.

## 2026-10-20 crawl --out 정리 (CLI-F6-04)
- **시작할 때 crawl 이 쓰는 이름만 지운다** — `<out>/로그아웃/` · `<out>/로그인/`(통째로) · `index.json` · `list.json` · `links.json` · `apis.json` · `summary.json`. 폴더 자체 · 다른 파일(`kept/` · 메모 …)은 둔다. 자리는 cli `crawl` 갈래의 인자 확인(`--max` · `--minutes` · `--keep` 읽기 · `--role` · 로그인 스크립트 읽기) 뒤, `crawl()` 앞 — 거절이면 Appium 을 한 번도 안 부른다. `--keep` 은 지우기 전에 읽으니 저장본이 out 안에 있어도 된다. 로그아웃 판만 도는 실행도 지난 `로그인/` 을 지운다(섞이면 안 되니까). 도중에 죽으면 지운 뒤 본 것까지만 남는다.
- **거절 규칙(`지난결과를지운다`, `path.resolve` 로만 견준다)**: `곳 === parse(곳).root`(뿌리) · `곳 === resolve(homedir())`(홈 자체) · `cwd === 곳`(작업 폴더 자체) · `cwd.startsWith(곳 + sep)`(작업 폴더의 위 폴더). test_platform 은 작업 트리 안 전부를 거절하지만 여기 기본 `.appium-cli/crawl/` 은 작업 폴더 아래(gitignore)라 뜻만 옮겼다 — 홈 아래 · 작업 폴더 아래 폴더는 받는다. 상태 폴더 둘 중 하나라도 `lstat` 이 symlink 면 거절(따라가지 않는다). 거절은 다 본 뒤에 지운다. 지우는 것이 크롤 이름뿐이라 규칙을 더 넓히지 않았다.
- `ponytail:` realpath 는 안 본다 — macOS `/var` ↔ `/private/var` 처럼 이름만 다른 같은 곳은 위 폴더로 못 가린다. 결과 json 이 symlink 면 `rm` 이 링크만 지운다(대상은 안 건드린다).
- 테스트(`test/crawl.test.ts` `crawl --out 정리`): 지난 `로그아웃/099.yml` · `로그인/050.yml` · 옛 list · apis 가 사라지고 `note.txt` 는 남는다 / `/` · 홈(`HOME` 을 임시 폴더로 stub) · `.` · cwd 절대 경로 · `..` · `../..` 가 거절되고 심어 둔 파일이 다 남고 fetch 0번 / `로그인` 이 symlink 면 거절 · 대상 파일 남음 · fetch 0번. 테스트 142개.

## 2026-10-20 실기기 확인 2 (CLI-F6-05) — 팜 폰 R3CR10TCVCD(SM-G996N · Android 15) · 데모마켓 android debug(Kotlin + Compose)
- 흐름: devices(IDLE) → hold 30 → `open --app app-debug.apk --cap appium:optionalIntentArguments='--es server http://172.25.28.63:3002' --cap appium:autoGrantPermissions=true`(설치 포함 15.4초, session `2d7541e2…`) → 로그인(user2) · 상품 상세 · 장바구니 담기 · 장바구니 · 주문하기 화면 → crawl 둘 → close → artifacts → release → IDLE. 고친 뒤 cap 확인용으로 한 번 더 잡았다(session `f8be319b…`, 같은 흐름으로 닫고 놓음 → IDLE). 두 번 다 셸 trap(두 번째) · 26분 뒤 close · release 하는 감시 스크립트(첫 번째)를 걸었다.
- **`--cap` 을 팜이 받는다.** optionalIntentArguments 로 받은 서버에 앱이 닿았다 — 상품 목록 40개 · 로그인 POST · 장바구니 담기 토스트. `autoGrantPermissions` · `disableIdLocatorAutocompletion`(두 번째 session)도 session 이 열렸다.
- **Compose 앱의 id (고침).** `testTagsAsResourceId` 라 resource-id 가 `login_id` 처럼 꾸러미 없이 온다. UiAutomator2 는 `disableIdLocatorAutocompletion:false`(기본)면 `id=login_id` 에 `com.demomarket.app:id/` 를 붙여 찾아 404 다(`-android uiautomator resourceId("login_id")` · xpath 로는 찾혔다). 데모마켓 README 의 「`id=` · `~` 둘 다 찾힌다」는 이 cap 이 있어야 맞다. 그리고 `Modifier.tid()` 는 testTag 를 요소에, contentDescription 을 **자식 View**(같은 bounds)에 달아서 `~login_id` 는 입력칸이 아니라 그 View 를 찾는다 → `fill` 이 400 `Cannot set the element`. 그래서 Compose 입력칸은 cap + `id=` 로만 넣는다. 버튼 `~add_cart_button` 등은 자식 View 를 눌러도 눌렸다. 실기기에서 세션 중 `POST /appium/settings {disableIdLocatorAutocompletion:true}` 로 켜고 이어 갔고, 두 번째 session 은 cap 으로 열어 `fill id=login_id` · `id=login_password` · `tap id=login_button` 이 됐다.
  - 고침(a9fa305): `요소를찾는다` 가 꾸러미 없는 `id=` 를 못 찾으면 까닭 끝에 cap 을 알린다(tap · fill · 로그인 스크립트가 다 거친다). crawl `누른다` 는 하나뿐인 선택자가 꾸러미 없는 `id=` 인데 못 찾으면 좌표로 누른다 — 안 고치면 cap 없는 Compose 앱 크롤은 id 만 가진 버튼(데모마켓 버튼 전부)을 「그사이 사라진 요소」로 조용히 건너뛰어 한 장짜리 지도가 된다. 다른 선택자를 못 찾으면 전처럼 건너뛴다(확인 창 테스트 그대로). **기본 cap 으로 넣지 않았다** — capabilities 는 kit 과 같게 둔다는 결정(F3-01)이고, CLI 에서만 통하는 `id=` 가 케이스에서 깨지면 안 된다. test_platform kit 이 Compose 앱을 돌리려면 같은 cap 이 있어야 한다(그쪽 몫).
- **`screen` 키 (반복해도 같았다).** 로그인 `app:.MainActivity/login_id · 아이디`(4번, 앱 재시작 뒤도), 상품 목록 `…/product_list · 데모 니트 가디건`(3번), 상세 `…/product_description · <상품 설명>`(2번), 장바구니 `…/cart_list · 데모 니트 가디건`(2번), 주문하기 `…/receiver · 받는 분`(2번), 주문 내역(빈) `…/orders_empty · 주문 내역이 없습니다`. Compose 는 화면 컨테이너에 desc 가 없어 「누르지 못하는 desc 요소 중 가장 큰 것」이 본문 요소(입력칸 자식 View · 설명 글 · 목록)가 된다 — 같은 상태에선 안 흔들리지만 **자료에 따라 바뀐다**: crawl 에서 장바구니가 `…/back_button` 으로 남았다(목록을 받아 오기 전 화면이 두 번 같아 가라앉음으로 봤다), 주문 내역은 비면 `orders_empty`. 이름(첫 TextView)도 상품마다 다르다. 모든 화면에 `desc="screen_title"` 이 있지만 작아서 안 뽑힌다. 고치지 않았다 — 키 규칙을 바꾸면 F5-05 MDA 키가 흔들린다. 로딩 대기 · Compose 용 규칙은 실측이 더 모이면.
- **`attrs` — UiAutomator2 가 주는 속성(EditText 실측)**: `class` · `resource-id` · `text` · `a11y-focused` · `a11y-important` · `bounds` · `checkable` · `checked` · `clickable` · `content-invalid` · `context-clickable` · `dismissable` · `displayed` · `drawing-order` · `enabled` · `focusable` · `focused` · `heading` · `index` · `live-region` · `long-clickable` · `package` · `password` · `screen-reader-focusable` · `scrollable` · `selected` · `showing-hint` · `text-entry-key` · `window-id`(29개). **`hint` · 최대 글자(max length) · 필수는 없다** — `showing-hint=false` 뿐. Compose 라벨(「아이디」)은 EditText 의 자식 TextView 로 따로 온다. EditText 에 `content-desc` 키가 아예 없다(자식 View 에 있다). 비밀번호 칸은 `text` 키가 빠지고 `password=true`. session 파일 13,246 bytes(11요소 화면 — 마지막에 찍은 것). 경계값 케이스는 화면 속성으로 못 만든다 — 기획서 · 서버 검증에서 얻는다.
- **좌표 fill (고침).** CLI 갈래는 확인 못 했다 — 데모마켓 입력칸(login_id · login_password · receiver · phone · address_detail)은 다 id 가 하나뿐이라 좌표로 안 간다. 같은 동작을 curl 로 따라 했다: 가운데 누르기 → `GET element/active` → `value`. receiver 첫 시도(키보드가 아직 안 뜬 때)는 누르고 1초 뒤 `element/active` 가 **no such element**, 그 뒤엔 잡혀 「홍길동」이 들어갔다. phone · address_detail(키보드 숨긴 뒤 포함)은 바로 잡혔다(누름부터 1.1~1.4초). → fill 좌표 갈래가 `element/active` 를 `찾기_ms`(10초) 동안 다시 묻는다(cli `될때까지` — 선택자 찾기와 같은 되풀이). 입력칸을 누른 직후 snapshot 이 한 번 `요소 0개`(31 bytes)였다 — 키보드가 뜨는 사이로 보인다(액션 뒤 가라앉기는 「앞과 다르고 두 번 같으면」이라 빈 화면 두 번이면 거기서 멈출 수 있다 · 미대응).
- **logs.** 첫 호출 10,000줄 버림. `logs --api` 두 번 다 「새 줄 없음」(Api.kt 에 로그 줄이 없다 — 아래). 사이 줄 수: 상품 한 번 누름 사이 11줄, 장바구니 담기 · 장바구니 이동 사이(약 20초) 604줄, crawl 뒤 22줄.
- **`artifacts`(close 뒤 5.2초).** `logcat.txt` 4,026,652 bytes · `video-1.mp4` 1,796,328 · `video-2.mp4` 18,453,653 · `video-3.mp4` 2,549,502(셋 다 ISO Media MP4). 7.5분 session 에 영상이 셋 — 팜이 나눠 찍는다(logcat 끝줄이 팜의 `rm -f /sdcard/df-<sid>-3.mp4`). 증적에서 영상은 여러 개일 수 있다.
- **팜 `logcat.txt` 꼴 = threadtime.** 24,222줄(14:24:30.766 ~ 14:32:08.905) 중 `--------- beginning of main|system` 두 줄 말고 전부 `MM-DD HH:MM:SS.mmm  PID  TID L 태그: 글`(`10-20 14:24:30.766  1787  2265 D ConnectivityService: …`) — `apiLines` 시각꼴(`^\d\d-\d\d \d\d:\d\d:\d\d\.\d+`)에 맞는다. `apis --file` 원본 → `[]`(오류 없음). 복사본에 OkHttp 줄 둘(`I okhttp.OkHttpClient: --> GET http://…/api/products?page=1&category=all` · `D OkHttp  : --> POST http://…/api/auth/login (52-byte body)`)을 붙이니 `[{GET …/api/products, at 10-20 14:30:01.123}, {POST …/api/auth/login, at …456}]` — 물음표 뒤 · `(52-byte body)` 가 빠지고 at 이 붙는다. 앱 줄(`demomarket` 든 줄)은 1,698줄로 대부분 설치 dex2oat.
- **crawl.** 로그인 화면(앱 첫 화면)에서 `--max 15 --minutes 5`: 로그아웃 1장 · 연결 0 · 누름 3 · 재시작 0 · 12.6초 — 로그인 화면엔 입력칸 둘 · 로그인 버튼뿐이고 빈 로그인은 같은 키에 오류 글만 더한다.
  - **로그인 판은 못 돌렸다.** `--login` 은 판 사이에 `mobile: clearApp` 을 하는데, 데모마켓은 optionalIntentArguments 로 받은 서버 주소를 앱 데이터(SharedPreferences)에 둔다 → 지우고 `activateApp`(intent 인자 없음)하면 `localhost:3002` 로 가서 로그인이 실패한다. 팜에서 adb reverse 를 못 쓰니 막힌다. 고치려면 앱 비우기 뒤 session 의 intent 인자로 다시 띄워야 한다(`mobile: startActivity` + extras) — F6-10 `app clear` 와 같이 볼 것. 이번엔 안 했다.
  - 덤: 로그인한 뒤 상품 목록에서 `--exclude '/^category_/'` 로 돌림(session 설정으로 id 자동완성을 끈 채): 4장(product_list · back_button(=장바구니, 위 로딩) · orders_empty · product_description) · 연결 3 · 누름 3 · 재시작 3 · 36.7초. 아래 화면은 못 갔다 — 재시작이 앱 첫 화면(로그인)으로 와서 경로 `cart_button` 을 못 찾는다(F5-02 「앱 첫 화면에서 시작」 그대로). `product_item` 8줄은 이름이 같아 한 번만 · 좌표로 눌렸다(설계대로). 상품 상세의 `color_option` · `size_option` 도 같은 이름 여럿이다.
- **API 배정은 건너뛰었다** — 데모마켓 `Api.kt` 수정을 이번엔 허락받지 않아 앱이 네트워크 줄을 안 남긴다(API 0개). 파서가 실제 팜 줄 꼴에서 도는 것만 위 합성 줄로 확인했다.
- 테스트 145개(142 + 3: 꾸러미 없는 id 까닭 · 좌표 fill active 다시 묻기 · crawl 좌표 대체).

## 2026-10-20 crawl 스크롤 (CLI-F6-06)
- **언제 · 무엇을.** 화면 후보(깊이 0)를 다 누른 뒤 그 화면에 scrollable 요소가 있으면(화면에 처음 왔을 때 본다 — 없으면 밀려고 재시작하지 않는다) 가장 큰 scrollable 의 bounds 에 `mobile: swipeGesture {left, top, width, height, direction:'up', percent:0.75}` 을 보낸다(swipe 명령과 같은 스크립트 · 같은 percent, 자리만 화면 대신 요소). 가라앉기는 `본다(앞 글)` 그대로 — 목록 끝이라 안 바뀌면 최대_ms(3초)를 다 기다린다. 민 뒤 이 화면에서 처음 보는 이름(`후보들` 이름 기준)을 깊이 n 으로 할일 끝에 붙여 똑같이 누른다. 새 이름이 없으면 · 화면당 다섯 번(`스크롤상한`) · 할일이 30 개(`화면누름상한`, 깊이를 합쳐 셈)면 끝. 시간 상한은 미는 앞에도 본다.
- **같은 이름은 새 후보가 아니다.** 데모마켓 상품 목록처럼 줄마다 `product_item` 이 되풀이되면 한 번 밀고 새 후보 없음으로 끝난다(F6-05 「같은 이름 한 번」 규칙 그대로). 「끝까지 내리면 더 불러오기」(데모마켓 `ProductsScreen.kt`)도 이름이 같은 줄이 더 붙을 뿐이라 새 후보가 안 생긴다 — 상품마다 따로 누르려면 이름 규칙을 바꿔야 한다(안 했다).
- **path 표현 = 문자열 걸음 `↓<n>`.** `["to list", "↓2", "item 7"]` = 시작 화면에서 `to list` 를 누르고, 간 화면의 본문 목록을 위로 2 번 민 뒤 `item 7` 을 누른다. 깊이 0 후보는 걸음을 안 붙여 옛 path 와 같다(뒤 호환). 구조 걸음(`{스크롤: n}`) 대신 문자열을 고른 까닭: `path: string[]` 타입 · `index.json` 모양을 안 바꾸고, test_platform 꼴 파일(list · links · apis)에는 path 가 없다. `↓` + 숫자만인 후보 이름은 걸음으로 읽힌다(그런 이름은 못 봤다).
- **보이게(목표, 깊이, 이름들).** 깊이 n 후보를 누르기 전 · 다음 깊이로 밀기 전에 부른다. 목표 화면이 아니면 재시작 + path. 깊이 0 이면 그것으로 끝(옛 동작 — 안 보이면 건너뜀). 깊이 n 이면 ① 지금 보이면 그대로(back 뒤 목록 자리가 남는 앱 — RecyclerView · LazyColumn rememberSaveable · RN stack 은 보통 남는다) ② 아니면 위로 n 번까지 밀며 찾고(back 뒤 처음으로 가는 앱 — 재시작 없이) ③ 그래도 없으면 재시작 + path + n 번 민다 ④ 그래도 없으면 건너뜀. 다음 깊이로 밀 때는 「깊이 n 에서 처음 본 이름」 중 하나가 보여야 깊이 n 에 있다고 본다 — 아니면 그만 민다.
- **화면 키는 밀어도 그대로** — 키는 본문 컨테이너(desc → id)에서 나오고 목록 줄은 그 안이다(테스트로 지킨다). 구조 지문은 줄 짜임이 다르면 바뀔 수 있지만 키에는 안 쓰인다(이름표가 없는 화면만 지문이 키). 누른 뒤 back 판정(`structFp` 비교)은 누르기 바로 앞 화면과 견주니 민 것 때문에 back 하지 않는다.
- `ponytail:` 가장 큰 scrollable 이 가로 목록(분류 칩)이면 위로 밀어도 안 움직여 새 후보 없음으로 끝난다 — 그런 앱이 나오면 세로 목록을 고른다.
- 테스트(`test/crawl.test.ts` — 가짜 앱에 `목록` · `창크기` · 화면별 `내림`: 새로 가면 0, 재시작이면 다 0, back 이면 남음(`돌아옴자리버림` 이면 0)): 한 번 · 두 번 민 뒤 보이는 후보를 누르고 새 후보가 없으면 그만 · 스크롤 요소 bounds 로 민다 · 키 그대로 / back 뒤 목록이 처음이면 재시작 없이 다시 밀어 누르고, 스크롤 뒤 화면(`["↓1","r4"]`)과 그 밑 화면(`["↓1","r4","to t"]`)을 재시작 + 경로로 간다 / 다섯 번 상한(18개) · 누름 30 상한(세 번 밀고 30개) / 컨테이너 키 단위 테스트. 테스트 150개.
- 확인 못 한 것(실기기는 F6-07 과 함께): 실제 RecyclerView · LazyColumn 에서 요소 bounds 전체로 민 swipeGesture 가 끝 쪽 시스템 제스처 영역과 부딪히는지 · 끝에 닿은 뒤 화면 글이 정말 같아지는지(스크롤바 · 오버스크롤 효과로 글이 흔들리면 「새 후보 없음」은 그래도 맞지만 가라앉기를 다 기다린다) · back 뒤 목록 자리가 실제로 남는지(데모마켓 Compose · MDA RN).

## 2026-10-20 crawl 재시작 줄이기 (CLI-F6-07) — 팜 폰 R3CR10TCVCD · MDA v1.3.0 release
- **지름길 = 이미 본 연결로 넓이 우선.** 누른 뒤 간 화면이 목표와 다르면 `연결들`(판 · from · to · 걸음 — 걸음은 `↓n` + 후보 이름, links.json 과 같은 순간에 쌓는다)에 더한다. 목표 화면이 아닐 때(`간다`) 지금 키에서 목표 키까지 가장 짧은 길을 찾아 누르고 걸음마다 키를 본다. 따로 「조상이면 남은 path」 갈래는 없다 — 지금 화면이 목표 path 의 조상이면 넓이 우선 길이 곧 남은 path 다(테스트로 지킨다). 길이 없으면 back 한 번 뒤 다시 찾는다(끝 화면에서 나가는 연결이 없을 때 — 서랍 항목 화면). 길이 어긋나면(못 찾음 · 다른 앱 · 다른 키) 그 연결을 빼고 재시작 + path. 로그아웃 연결은 안 쓴다(로그인이 풀린다). 상한 · 시간은 그대로 — 지름길 누름은 `presses` 에 안 센다(재시작 경로 다시 누르기와 같다).
- **`↓n` 걸음은 다음 이름이 보이면 안 민다** — back 뒤 목록 자리가 남는 앱에서 지름길이 목록을 지나 내리지 않게. 재시작 뒤엔 목록이 처음이라 전과 같이 n 번 민다. 목록이 지나 내려가 있어 위로 밀어도 안 보이면 어긋남 → 재시작(테스트).
- **셈.** `index.json` `지름길: {닿음, 못닿음}`, 요약 줄 `재시작 n번 · 지름길 n번(못 닿음 n)`. 못 닿음 뒤 재시작은 `restarts` 에도 센다.
- **실측 (`--max 40 --minutes 6`, 로그아웃 판만, 이 커밋과 주석 한 줄만 다른 워크트리 빌드).** 로그아웃 13장 · 연결 29개 · 누름 43번 · **재시작 17번** · 지름길 10번(못 닿음 0) · 확인 창 15번 · 365초 · 시간에 닿음. F5-05 는 두 판 12분에 누름 66 · 재시작 47(누름의 71%), 로그아웃 몫 6분에 13장. → **재시작이 누름의 40%**, 누름 하나 약 8.5초(F5-05 약 11초). **장수 · 깊이는 안 늘었다** — 13장 · 가장 깊은 path 2걸음(서랍 → 항목)으로 같다. 지름길 10번은 다 「서랍 항목 화면 → back → products → `open menu` → 서랍」.
  - 남은 재시작 17번은 로그가 없어 다 가리지 못했다. 짐작: products(시작 화면)로 가는 연결이 9개(정렬 창 4 · 서랍의 catalog · reset · sort · cart 4 · 장바구니 Go Shopping 1)인데, 거기서 back 하면 앱 밖(런처)으로 나가 지름길이 없고 재시작한다. 맞다면 다음 손볼 곳은 앱 밖이면 `activateApp` 만(terminate 없이 — Android 12+ 는 뿌리 화면 back 이 앱을 뒤로 보내기만 한다) 하고 지름길을 찾는 것. 실기기로 원인을 못 봐 이번엔 안 했다.
- **F6-06 스크롤 (실기기에서 본 것 · 짐작).** MDA products · 서랍(아래 products ScrollView) · cart · product screen 이 다 `ScrollView 스크롤` 을 가졌다. 어느 path 에도 `↓` 가 없다 — products 는 줄마다 `store item text` · `review star 1~5` 가 되풀이돼 밀어도 새 이름이 없고(F6-06 「같은 이름 한 번」 그대로), 서랍 12항목은 한 화면에 다 보인다. 밀었는지 · 끝에서 글이 가라앉았는지 · 시스템 제스처와 부딪혔는지는 로그가 없어 못 봤다. 서랍의 qr code scanner · geo location · reset app 은 눌렀지만(권한 창 = 다른 앱 → back / 창) 새 키가 없었다.
- 테스트 153개(150 + 3: 서랍 허브 — back 이 바탕으로 가도 재시작 0 · 조상 화면에서 남은 path 만 · 지름길 어긋남 → 재시작 + `↓1` 경로). 기존 테스트 셋은 지름길로 바뀐 재시작 수 · 부름 차례를 고쳤다.
- 폰: release 직후 `OCCUPIED(cleaning)`(팜 정리 중 — 놓기는 됐다). 이 기록을 쓸 때는 팜(127.0.0.1:4723)이 안 떠 있어 IDLE 을 다시 못 봤다.

## 2026-10-20 fill --submit · hide-keyboard (CLI-F6-08) — 실기기 미확인(팜 꺼짐)
- **`fill … --submit` = `mobile: performEditorAction {action:'done'}`.** playwright-cli `fill --submit`(Enter) 자리. Android 에서 Enter 키(`pressKey 66`)는 앱의 `onEditorAction` 에 `IME_NULL` 로 가서 actionId 만 보는 앱 · Compose `KeyboardActions` 가 안 받을 수 있어 IME 동작을 골랐다. 동작은 `done` 하나 — 검색 · 이동(`search` · `go`)만 받는 칸이 나오면 `--submit` 에 이름을 받게 넓힌다(`ponytail:` 주석). 좌표 fill(주소 없음)에도 똑같이 보낸다.
- **Ran 줄은 동작마다 하나.** `Ran: await driver.$('…').setValue('…')` 다음 줄에 `Ran: await driver.execute('mobile: performEditorAction', { action: 'done' })` — 줄마다 그대로 옮겨 쓸 수 있다(「코드 한 줄」 규칙 유지).
- **`hide-keyboard` = `POST /session/{id}/appium/device/hide_keyboard` `{}`**, 코드 `await driver.hideKeyboard()`. webdriverio `hideKeyboard()` 가 보내는 요청과 같아서 CLI 가 한 것 = 케이스가 할 것이다. UiAutomator2 의 `mobile: hideKeyboard` 도 있지만 Ran 줄과 요청이 갈라져 안 골랐다 — 팜(Appium 3 등)이 이 길을 막으면 그쪽으로 바꾼다. 다른 액션처럼 뒤에 자동 snapshot(앞 화면과 견줘 가라앉기).
- **로그인 스크립트에도 받는다.** `hide-keyboard` 를 명령 목록에 더했고, `fill ~pw x --submit` 은 줄을 그대로 `run()` 에 넘기니 따로 할 일이 없다.
- 확인 못 한 것(팜 꺼짐 — 127.0.0.1:4723 에 아무도 안 들음): `performEditorAction` 이 Appium Settings IME 로 잠깐 바꿔 보내는데 팜이 그 IME 를 허락하는지 · setValue 뒤 그 칸에 포커스가 남아 있는지(아니면 다른 칸에 done 이 간다) · 키보드가 없을 때 hide_keyboard 답(오류인지 false 인지) · 데모마켓 Compose `ImeAction.Done` 이 실제로 받는지.
- 테스트 156개(153 + 3: fill --submit 요청 차례 · 몸 · Ran 두 줄 / hide-keyboard 요청 · Ran / 로그인 스크립트에 둘 다).

## 2026-10-20 attach (CLI-F6-09) — 실기기 미확인(팜 꺼짐)
- **`-s=<이름> attach <sessionId>` = POST /session 없이 session 파일만.** 웹 `playwright cli attach`(test_platform `tpx-cases/references/6-gates.md`) 자리. 먼저 `GET /session/{id}/source` 로 화면을 찍어 살아 있는지 보고, 된 뒤에야 파일을 적는다 — 끝난 session(404 `invalid session id`)이면 「session <id> 에 못 붙었다 — … 이미 끝난 session 이다」 를 내고 파일을 안 남긴다(open 은 파일을 먼저 적지만 attach 는 거꾸로). 번호는 `[\w-]+` 만(경로에 들어간다, artifacts 와 같다). 같은 이름이 있으면 open 과 같은 말로 거절하고 Appium 을 안 부른다. 파일에 `붙음: true`.
- **close 는 DELETE 를 안 보낸다.** 남의 session(케이스가 아직 쥐고 있다)이라 파일만 지우고 「session <이름> 떼어냄 — <id> 는 열어 둔다(남의 session)」. **`.last` 도 안 적는다** — `artifacts` 기본값이 아직 도는 남의 session 을 가리키면 산출물이 `ready:false` 로 기다리다 빈손이 된다. 그 session 산출물은 케이스가 끝난 뒤 `artifacts <sessionId>` 로 받는다. 전에 있던 `.last` 는 건드리지 않는다.
- **붙은 session 의 `logs` · `crawl` 은 `--force` 가 있어야 한다.** Appium 은 logcat 줄을 session 마다 한 번만 준다(F5-01) — CLI 가 읽으면 kit · `apis --session-id` 쪽에서 그 줄이 사라져 케이스 ↔ API 증적이 빠진다. crawl 은 시작에 logcat 을 버리고 앱을 다시 띄우기까지 한다(케이스 화면이 깨진다). 아예 막지 않고 `--force` 로 연 까닭: 케이스가 이미 멈췄거나 증적이 필요 없는 디버깅이면 쓸 수 있게. 다른 명령(tap · fill · back …)은 그대로 — 케이스 화면을 바꾸는 것은 디버깅의 뜻이다.
- 확인 못 한 것(팜 꺼짐): 팜이 남의 토큰 · 다른 연결에서 연 session 의 source 를 이 토큰으로 내주는지(팜이 session 주인을 가리는지) · 케이스가 멈춘 동안 newCommandTimeout(300초) 안에 붙어야 하는지 · kit 쪽에서 session 번호를 어떻게 꺼내 주는지(test_platform 작업).
- 테스트 161개(156 + 5: attach 요청 · 파일 / 같은 이름 거절 / 끝난 session · 파일 없음 / close 가 DELETE · .last 없음 / logs · crawl 거절 · --force).

## 2026-10-20 app restart · clear · record (CLI-F6-10) — 실기기 미확인(팜 꺼짐)
- **`app restart` = `mobile: terminateApp` → 다시 띄우기, `app clear` = `mobile: clearApp` → 다시 띄우기.** crawl 이 팜에서 쓴 길(F5-05) 그대로 보낸다. Ran 줄은 작업 지시대로 `await driver.terminateApp('…')` · `await driver.execute('mobile: clearApp', { appId: '…' })` · `await driver.activateApp('…')` — 보낸 요청(`mobile: …`)과 webdriverio 함수 이름이 다르다(같은 동작). 그 뒤 자동 snapshot(앞 화면과 견줘 가라앉기). clearApp 을 팜이 막으면 그대로 던진다 — crawl 처럼 terminateApp 으로 물러서지 않는다(사람이 「지워라」 한 명령이라). 꾸러미는 session 파일 `앱.appPackage`, 없으면 `current_package`.
- **intent 인자 고침(F6-05 「실기기 확인 2」).** 데모마켓은 `optionalIntentArguments` 로 받은 서버 주소를 앱 데이터에 둬서 clearApp 뒤 activateApp 하면 `localhost:3002` 로 간다 → 로그인 판이 안 돌았다. 이제 `open` 이 session 답의 `appPackage` · `appActivity` · `optionalIntentArguments`(답에 없으면 보낸 `--cap` 값 — 답은 접두 없는 키 · `appium:` 키 둘 다 본다)를 session 파일 `앱` 에 두고, 다시 띄울 때 intent 인자 · activity 를 다 알면 `mobile: startActivity { intent: '<pkg>/<appActivity>', extras: [['s','server','http://…'], …] }` 로, 아니면 `mobile: activateApp { appId }` 로 띄운다(`src/appium.ts` `띄우기`). `crawl --login` 의 판 사이 앱 비우기 뒤에도 같은 함수 — crawl 꾸러미는 시작 때 `current_package`. 앱 비우기 없는 crawl 재시작(`되돌린다`)은 그대로 activateApp(데이터가 남아 주소를 안 잃는다).
- **startActivity 인자 꼴** — UiAutomator2 `mobile: startActivity` 의 `intent`(필수, `pkg/activity`) · `extras`(배열의 배열 `[꼴, 키, 값]`, 값 없는 꼴 `sn` 은 둘). am 인자 `-e`·`--es`→`s`, `--esn`→`sn`, `--ez`→`z`, `--ei`→`i`, `--el`→`l`, `--ef`→`f`, `--eu`→`u` 만 옮긴다(따옴표로 띄어쓰기 묶음). 다른 인자(`-f` · `--activity-*` · 배열 꼴)면 **앱을 건드리기 전에** 던진다 — `app` 은 끄기 · 비우기 전, `crawl --login` 은 로그아웃 판 전(스크립트 · 역할처럼 먼저 본다). `wait` · `stop` 은 안 싣는다(앞에서 이미 껐다).
- **붙은 session 의 `app` 은 `--force`.** 케이스가 쓰는 앱을 끄거나 데이터까지 지운다. attach 는 `앱` 을 안 남겨 꾸러미는 `current_package`, 띄우기는 activateApp.
- **`record start` · `record stop [--out <파일.mp4>]`** — `POST …/appium/start_recording_screen` · `stop_recording_screen`(webdriverio `startRecordingScreen` · `stopRecordingScreen` 길) → base64 를 mp4 로(기본 `.appium-cli/record-<시각>.mp4`). 빈 답이면 「record start 를 먼저 했는지」 로 던진다. 옵션(시간 상한 · 화질)은 안 받는다 — 기본 180초 상한(Appium 기본). 팜은 session 마다 영상을 남기니 `artifacts`(F6-02) — 팜에서 record 가 되는지 · 팜 녹화와 겹치는지는 안 봤다.
- 확인 못 한 것(팜 꺼짐): UiAutomator2 session 답에 apk 에서 읽은 `appPackage` · `appActivity` 가 실제로 실리는지(팜 프록시를 거쳐서도) — 안 실리면 `앱` 에 intent 인자만 남아 activateApp 으로 물러서니 `--cap appium:appActivity=…` 를 같이 준다 · 데모마켓이 startActivity extras 로 서버 주소를 다시 받는지(로그인 판 실기기) · `mobile: startActivity` 를 팜이 허락하는지 · 로컬 Appium 녹화 실측.
- 테스트 167개(161 + 6: app clear 가 intent 인자를 startActivity extras 로 · Ran 둘 · session 파일 `앱` / app restart 가 current_package 로 terminate · activate / 못 옮기는 인자 · 모르는 하위 명령은 앱을 안 건드림 / 붙은 session 거절 · --force / record start · stop · 빈 영상 / crawl --login 이 clearApp 뒤 startActivity extras · 못 옮기는 인자는 Appium 을 부르기 전 거절).
