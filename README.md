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
npx appium-cli -s=probe crawl --max 50 --minutes 10   # → .appium-cli/crawl.json
```

⚠️ 안 누를 것 판정(로그아웃 · 탈퇴 · 결제 …)은 다음 판(CLI-F5-03)이다 — 그 전에는 지워져도 되는 앱 · 계정에서만 돌린다.

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
