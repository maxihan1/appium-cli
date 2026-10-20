# appium-cli

코딩 에이전트용 Appium CLI. 웹의 `playwright-cli` 처럼 **snapshot → ref → 액션** 루프로 Android 앱을 눌러 가며 요소 주소(`~desc` · `id=`)를 고르고, 액션마다 WebdriverIO 코드 한 줄을 낸다.
화면은 파일로 떨어지고 경로만 돌아온다 — MCP 처럼 화면 XML 이 대화에 실리지 않는다.

## 설치

```bash
npm i -D github:maxihan1/appium-cli#v0.1.0   # private 저장소 — git 이 GitHub 에 로그인돼 있어야 한다
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
npx appium-cli -s=probe fill e11 'bob@example.com'
npx appium-cli -s=probe generate-locator e17   # driver.$('~Login button')
npx appium-cli -s=probe close
npx appium-cli release                         # 놓는다 — 팜이 깐 앱 · 앱 데이터를 지운다
```

화면 한 줄이 요소 하나다. ref 는 마지막 화면에서만 유효하고, 액션마다 화면이 가라앉은 뒤 새로 찍힌다.

```
ViewGroup desc="Login button" 클릭 [56,1458][1024,1583] [ref=e17]
```

API 호출은 debug 빌드의 logcat(OkHttp `--> GET https://…`)에서 읽는다. 물음표 · `#` 뒤는 지운다.

```bash
npx appium-cli -s=probe logs                   # 첫 호출은 쌓인 줄을 버린다
npx appium-cli -s=probe logs --api             # 그 뒤 새 API 줄만: GET https://host/path
npx appium-cli apis --file logcat.txt          # 팜 logcat 파일 → [{"method","url","at"}]
npx appium-cli apis --session-id <id>          # 남이 연 session 에서 같은 JSON
```

앱 구조를 스스로 훑는다 — 지금 화면부터 눌러 가며 화면 키(`app:<activity>/<화면 이름표>`) · 화면 연결을 모은다.

```bash
npx appium-cli -s=probe crawl --max 50 --minutes 10   # → .appium-cli/crawl/list.json …
npx appium-cli -s=probe crawl --exclude '/설정|settings/i' --exclude 'com.shop:id/pay'   # 이름이 맞는 버튼은 안 누른다
npx appium-cli -s=probe crawl --out ../data/crawl --keep ../data/kept/index.json   # 저장본과 같음 · 바뀜 · 새 화면
```

결과는 test_platform 크롤러 출력 꼴이다(`--out`, 기본 `.appium-cli/crawl/`) — 화면 키가 그쪽 주소 · 틀 자리에 든다.

| 파일 | 내용 |
|------|------|
| `로그아웃/NNN.yml` | 화면 파일 — `# <화면 키>` · `# 입력칸: text 또는 password <desc 또는 id>[ · 읽기 전용]` · 화면 글 |
| `list.json` | `[{주소, 이름, 상태, 파일, 틀, 지문, 글자지문, 저장본?, 저장기록?}]` |
| `links.json` | `[{상태, 틀, 연결: [{to, via: "버튼 「이름」"}]}]` |
| `apis.json` | `[{상태, 틀, api: [{method, url}]}]` — 누른 뒤 logcat 의 API 는 간 화면 몫(안 바뀌었으면 누른 화면) |
| `summary.json` | `{멈춘까닭, 상태들, 예외}` |
| `index.json` | 크롤 원자료(경로 · 탈퇴흐름 · 로그인풀림 · 확인 창 셈) |

`--keep` 은 test_platform 저장본(`{판: 1, 항목: [{키, 상태, 틀, 주소, 지문, 글자지문, 기록, 훑은날}]}`)을 받는다 — 글자지문이 같고 30일 안이면 같음.

안 누르는 것 — 로그아웃(늘) · 12자 이하 이름이나 resource-id 에 위험 글자(삭제 · 결제 · 담기 · 해지 · delete · remove …)가 든 버튼 · `--exclude` 식에 맞는 이름(desc → id → 글자). 탈퇴 버튼은 누르되 그 뒤 화면(이름에 탈퇴가 든 화면도)에서는 아무것도 안 누른다. 누른 뒤 Android 확인 창이 뜨면 탈퇴 · 되돌릴 수 없음 경고 · 입력칸이면 back, 아니면 확인 버튼 하나를 누른다(`index.json` `dialogs`). 아이디 칸 + 비밀번호 칸이 같이 뜬 화면은 `로그인풀림: true`.

## 연결

| 값 | 옵션 | 환경값 |
|----|------|--------|
| Appium 주소 | `--url` | `PLATFORM_APPIUM_URL` (없으면 `http://127.0.0.1:4723`) |
| 팜 토큰 (Bearer) | `--token` | `PLATFORM_APPIUM_TOKEN` |
| 앱 — apk 경로 또는 URL | `--app` | `PLATFORM_APP` |
| 폰 지정 | `--udid` | `PLATFORM_DEVICE_UDID` |
| 팜 폰 고르기 (`os>=13,model=SM-*`) | `--filter` | — |
| API 줄 꼴 (모임 둘: method · url) | `--api-pattern` | — |

에이전트 지침은 [`skill/SKILL.md`](skill/SKILL.md), 결정과 실측은 [`context-notes.md`](context-notes.md), 진행판은 [`docs/wbs.md`](docs/wbs.md).

## 개발

```bash
npm test          # vitest
npm run typecheck
npm run build     # dist/
```
