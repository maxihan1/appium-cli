# appium-cli

코딩 에이전트용 Appium CLI. 웹의 `playwright-cli` 처럼 **snapshot → ref → 액션** 루프로 Android 앱을 눌러 가며 요소 주소(`~desc` · `id=`)를 고르고, 액션마다 WebdriverIO 코드 한 줄을 낸다.
화면은 파일로 떨어지고 경로만 돌아온다 — MCP 처럼 화면 XML 이 대화에 실리지 않는다.

## 설치

```bash
npm i -D github:maxihan1/appium-cli#v0.3.1   # private 저장소 — git 이 GitHub 에 로그인돼 있어야 한다
npx appium-cli help
```

Node 22 이상. 런타임 의존성은 없다(설치할 때 `prepare` 가 TypeScript 를 빌드한다).

## 루프

```bash
npx appium-cli devices                         # 디바이스 팜이면: 폰과 상태
npx appium-cli hold --minutes 30               # 폰을 잡는다
npx appium-cli -s=probe open                   # 앱을 띄우고 첫 화면을 찍는다
npx appium-cli -s=probe find --regex "/log ?in/i"
npx appium-cli -s=probe tap e19                # Ran: await driver.$('~menu item log in').click()
npx appium-cli -s=probe tap '~open menu'       # ref 대신 선택자도 된다 — 지금 화면에서 찾는다(앱이 뜨는 동안 10초까지 기다린다)
npx appium-cli -s=probe fill e11 'bob@example.com'
npx appium-cli -s=probe fill e12 '10203040' --submit   # 넣은 뒤 키보드 완료(mobile: performEditorAction done) — Ran 줄 둘
npx appium-cli -s=probe hide-keyboard          # 키보드가 아래 버튼을 가리면 — Ran: await driver.hideKeyboard()
npx appium-cli -s=probe generate-locator e17   # driver.$('~Login button')
npx appium-cli -s=probe app restart            # Ran: await driver.terminateApp('…') · activateApp — 새 화면
npx appium-cli -s=probe app clear              # Ran: mobile: clearApp — 앱 데이터를 지우고 다시 띄운다
npx appium-cli -s=probe close
npx appium-cli release                         # 놓는다 — 팜이 깐 앱 · 앱 데이터를 지운다
```

화면 한 줄이 요소 하나다. ref 는 마지막 화면에서만 유효하고, 액션마다 화면이 가라앉은 뒤 새로 찍힌다.

```
ViewGroup desc="Login button" 클릭 [56,1458][1024,1583] [ref=e17]
```

입력칸 경계값 케이스(최대 글자 · 필수 · 형식)를 만들 때는 그 요소의 원래 XML 속성을 본다 — 웹 작성의 `playwright cli eval` 자리다. 앞 다섯(class · resource-id · content-desc · text · hint, 있는 것만) 뒤는 알파벳 차례, 비밀번호 칸 text 는 안 낸다. UiAutomator2 가 주는 속성만 나온다(hint · 최대 글자가 없으면 없다). 화면 글처럼 이 값도 기대값 자료가 아니다.

```bash
npx appium-cli -s=probe attrs e11              # class=android.widget.EditText · resource-id=… · hint=… · bounds=… · focusable=true …(한 줄에 하나)
```

API 호출은 debug 빌드의 logcat(OkHttp `--> GET https://…`)에서 읽는다. 물음표 · `#` 뒤는 지운다.

```bash
npx appium-cli -s=probe logs                   # 첫 호출은 쌓인 줄을 버린다
npx appium-cli -s=probe logs --api             # 그 뒤 새 API 줄만: GET https://host/path
npx appium-cli apis --file logcat.txt          # 팜 logcat 파일 → [{"method","url","at"}]
npx appium-cli apis --session-id <id>          # 남이 연 session 에서 같은 JSON
```

디바이스 팜은 session 마다 영상 · logcat 을 남긴다(30일 보관). `artifacts` 가 받는다 — 받은 `logcat.txt` 는 `apis --file` 에 그대로 넣는다.

```bash
npx appium-cli -s=probe close                  # 번호를 남긴다
npx appium-cli -s=probe artifacts              # - video-1.mp4 2223904 bytes: .appium-cli/artifacts/<id>/video-1.mp4 …
npx appium-cli artifacts <sessionId> --out ev  # 남이 연 session · 다른 폴더
npx appium-cli apis --file .appium-cli/artifacts/<id>/logcat.txt
```

팜이 아직 만드는 중(`ready:false`)이면 15초까지 기다린다.

`app restart` · `app clear` 는 open 이 보낸 intent 인자(`--cap appium:optionalIntentArguments=…`)가 있으면 `activateApp` 대신 `mobile: startActivity`(`component: <꾸러미>/<activity>` · 같은 extras)로 다시 띄운다 — 서버 주소를 intent 로 받아 앱 데이터에 두는 앱(데모마켓)이 clear 뒤에도 같은 서버로 간다. `crawl --login` 도 판 사이에 같은 길로 띄운다. extras 깃발(`-e` · `--es` · `--esn` · `--ez` · `--ei` · `--el` · `--ef` · `--eu`)만 옮기고, 다른 인자면 앱을 건드리기 전에 거절한다. 붙은 session 은 `--force` 가 있어야 한다.

로컬 Appium(팜 아님)에서 영상이 필요하면 `record` 로 찍는다. 팜은 session 마다 영상을 남기니 `artifacts` 를 쓴다.

```bash
npx appium-cli -s=probe record start
npx appium-cli -s=probe record stop --out run.mp4   # - Video: run.mp4 (기본 .appium-cli/record-<시각>.mp4)
```

남이 연 session(kit 케이스 디버깅)에는 `attach` 로 붙는다. session 을 새로 열지 않고 지금 화면만 찍는다. `close` 는 그 session 을 닫지 않고 CLI 파일만 지운다(`.last` 도 안 남긴다).

```bash
npx appium-cli -s=kit attach <sessionId>       # session kit 붙음 (<id>) — 그 뒤 snapshot · tap · fill …
npx appium-cli -s=kit close                    # session kit 떼어냄 — <id> 는 열어 둔다
```

붙은 session 의 `logs` · `crawl` 은 `--force` 가 있어야 한다. Appium 은 logcat 줄을 session 마다 한 번만 주니 여기서 읽으면 케이스 쪽에서 그 줄이 사라진다(crawl 은 앱도 다시 띄운다).

앱 구조를 스스로 훑는다 — 지금 화면부터 눌러 가며 화면 키(`app:<activity>/<화면 이름표>`) · 화면 연결을 모은다.

```bash
npx appium-cli -s=probe crawl --max 50 --minutes 10   # → .appium-cli/crawl/list.json …
npx appium-cli -s=probe crawl --exclude '/설정|settings/i' --exclude 'com.shop:id/pay'   # 이름이 맞는 버튼은 안 누른다
npx appium-cli -s=probe crawl --out ../data/crawl --keep ../data/kept/index.json   # 저장본과 같음 · 바뀜 · 새 화면
```

`--login <스크립트>` 면 로그아웃 판을 돈 뒤 앱 데이터를 지우고(`mobile: clearApp`, 팜이 막으면 `terminateApp` 으로 끄기만) 스크립트로 로그인해 `로그인:<역할>` 판(`--role`, 기본 `일반 회원`)을 돈다. `--max` · `--minutes` 는 판마다 나눈다(앞 판이 덜 쓴 장수는 뒤로).
스크립트는 `appium-cli -s=<이름>` 뒤에 쓰는 명령을 한 줄에 하나씩 — `tap` · `fill`(`--submit` 도) · `back` · `swipe` · `hide-keyboard` 만, `tap` · `fill` 은 ref 대신 선택자(`~desc` · `id=…`)로, 띄어쓰기는 따옴표로 묶는다. 빈 줄 · `#` 줄은 건너뛴다. 끝나면 앱 첫 화면이어야 한다(크롤이 앱을 다시 띄워 거기서 경로를 누른다).

```
# login.txt — MDA
tap '~open menu'
tap '~menu item log in'
fill '~Username input field' bob@example.com
fill '~Password input field' 10203040
tap '~Login button'
```

로그인 판에서 로그인 화면(아이디 칸 + 비밀번호 칸)이 뜨면 앱을 비우고 다시 로그인해 그 버튼을 한 번 더 누른다 — 또 뜨면 로그인 칸이 있는 화면으로 남기고 목록에서 뺀다. 로그아웃 버튼은 다시 로그인할 수 있을 때만 누른다. 다시 로그인은 세 번까지.

결과는 test_platform 크롤러 출력 꼴이다(`--out`, 기본 `.appium-cli/crawl/`) — 화면 키가 그쪽 주소 · 틀 자리에 든다. 시작할 때 그 폴더의 지난 결과(아래 상태 폴더 · json)만 지우고 다른 파일은 둔다. `--out` 이 파일 시스템 뿌리 · 홈 · 작업 폴더 자체나 그 위 폴더면, 또는 상태 폴더가 symlink 면 아무것도 지우지 않고 거절한다.

| 파일 | 내용 |
|------|------|
| `로그아웃/NNN.yml` · `로그인/NNN.yml` | 화면 파일 — `# <화면 키>` · `# 입력칸: text 또는 password <desc 또는 id>[ · 읽기 전용]` · 화면 글. 번호는 판을 이어 매긴다 |
| `list.json` | `[{주소, 이름, 상태, 파일, 틀, 지문, 글자지문, 저장본?, 저장기록?}]` — 로그인 판에도 있는 키의 로그아웃 화면은 뺀다(시작 화면은 둘 다) |
| `links.json` | `[{상태, 틀, 연결: [{to, via: "버튼 「이름」"}]}]` — 빠진 로그아웃 화면의 연결은 같은 키의 로그인 화면에 합친다 |
| `apis.json` | `[{상태, 틀, api: [{method, url}]}]` — 누른 뒤 logcat 의 API 는 간 화면 몫(안 바뀌었으면 누른 화면) |
| `summary.json` | `{멈춘까닭, 상태들, 예외}` |
| `index.json` | 크롤 원자료(판 · 경로(`↓n` = 목록을 n 번 민다) · 탈퇴흐름 · 로그인풀림 · 확인 창 셈 · 다시 로그인 · 앱 비우기) |

`--keep` 은 test_platform 저장본(`{판: 1, 항목: [{키, 상태, 틀, 주소, 지문, 글자지문, 기록, 훑은날}]}`)을 받는다 — 글자지문이 같고 30일 안이면 같음.

화면 후보를 다 누르면 그 화면의 스크롤 요소(가장 큰 것)를 위로 밀어(`mobile: swipeGesture` up) 처음 보는 이름의 후보도 누른다 — 새 후보가 없으면 그만, 화면당 다섯 번 · 누름 30 번까지. 같은 이름이 줄마다 되풀이되는 목록(상품 칸)은 한 번만 누르니 밀어도 새 후보가 없다. 그렇게 간 화면의 경로(`index.json` `path`)에는 `↓<n>`(그 화면 목록을 위로 n 번 민다) 걸음이 든다 — `["to list", "↓2", "item 7"]`. 화면 키는 컨테이너에서 나와 밀어도 안 바뀐다.

back 이 다른 화면(서랍 항목 → 바탕 화면)으로 가면 다음 화면에 가기 전에 지금 화면에서 이미 본 연결로 가장 짧은 길을 먼저 누르고(화면마다 키를 본다, 길이 없으면 back 한 번 뒤 다시 찾고) 길이 없거나 어긋날 때만 앱을 다시 띄워 경로를 다시 누른다 — 요약 줄 `재시작 n번 · 지름길 n번(못 닿음 n)`, `index.json` `restarts` · `지름길`.

안 누르는 것 — 로그아웃(로그인 판에서 다시 로그인할 수 있을 때만 누른다) · 12자 이하 이름이나 resource-id 에 위험 글자(삭제 · 결제 · 담기 · 해지 · delete · remove …)가 든 버튼 · `--exclude` 식에 맞는 이름(desc → id → 글자). 탈퇴 버튼은 누르되 그 뒤 화면(이름에 탈퇴가 든 화면도)에서는 아무것도 안 누른다. 누른 뒤 Android 확인 창이 뜨면 탈퇴 · 되돌릴 수 없음 경고 · 입력칸이면 back, 아니면 확인 버튼 하나를 누른다(`index.json` `dialogs`). 아이디 칸 + 비밀번호 칸이 같이 뜬 화면은 `로그인풀림: true`(로그아웃 판에서는 표시만).

## 화면 키 · 라이브러리

케이스 ↔ 화면을 잇는 재료다 — 앱 화면 파일(page object)에 화면 주소 값으로 지금 화면 키를 적는다. 키는 crawl 이 남기는 것과 같은 규칙이다.

```bash
npx appium-cli -s=probe screen                 # app:.Main/login screen · Login   (이름이 없으면 키만)
```

test_platform kit · 러너 · 스캐너는 CLI 를 띄우지 않고 같은 규칙을 부른다.

```ts
import { screenKey, parseSource, apiLines, farmArtifacts } from 'appium-cli';

screenKey(xml, '.Main');        // { key: 'app:.Main/login screen', name: 'Login', structFp: '3f2a…' } — xml 은 GET /session/:id/source, '.Main' 은 current_activity
parseSource(xml);               // { 글, refs, width, height } — snapshot 파일과 같은 글 · ref 표
apiLines(logcatLines);          // [{ method, url, at }] — apis --file 과 같다 (둘째 인자로 꼴 바꾸기)
await farmArtifacts('http://farm:4723/wd/hub', sessionId, 'out', { token });   // { files: [{ name, bytes, path }], errors } — artifacts 와 같다
```

## 연결

| 값 | 옵션 | 환경값 |
|----|------|--------|
| Appium 주소 | `--url` | `PLATFORM_APPIUM_URL` (없으면 `http://127.0.0.1:4723`) |
| 팜 토큰 (Bearer) | `--token` | `PLATFORM_APPIUM_TOKEN` |
| 앱 — apk 경로 또는 URL | `--app` | `PLATFORM_APP` |
| 폰 지정 | `--udid` | `PLATFORM_DEVICE_UDID` |
| 팜 폰 고르기 (`os>=13,model=SM-*`) | `--filter` | — |
| API 줄 꼴 (모임 둘: method · url) | `--api-pattern` | — |
| capabilities 더하기 (`open`, 여러 번 · 값이 JSON 이면 JSON · 기본값을 덮는다) | `--cap <키=값>` | — |

팜 · 컨테이너는 `adb reverse` 를 못 쓰니 앱 서버 주소 같은 값은 `--cap` 으로 준다(데모마켓 예).

```bash
npx appium-cli -s=probe open --app https://farm/demo-market.apk \
  --cap appium:optionalIntentArguments='--es server http://host:3002' \
  --cap appium:autoGrantPermissions=true \
  --cap appium:logcatFilterSpecs='["OkHttp:D","*:S"]'
```

Jetpack Compose 앱(`testTagsAsResourceId` — resource-id 가 `login_id` 처럼 꾸러미 없이 온다)은 `--cap appium:disableIdLocatorAutocompletion=true` 를 더한다.
UiAutomator2 가 꾸러미 없는 id 에 `<pkg>:id/` 를 붙여 찾아서 `id=login_id` 가 안 찾힌다. 같은 이름의 `~login_id` 는 입력칸이 아니라 그 안의 View 라 `fill` 이 안 된다(실측 — 데모마켓).
케이스를 돌리는 쪽(kit)도 같은 capability 가 있어야 `id=` 선택자가 통한다. `crawl` 은 이 경우 좌표로 누른다.

에이전트 지침은 [`skill/SKILL.md`](skill/SKILL.md), 결정과 실측은 [`context-notes.md`](context-notes.md), 진행판은 [`docs/wbs.md`](docs/wbs.md).

## 개발

```bash
npm test          # vitest
npm run typecheck
npm run build     # dist/
```
