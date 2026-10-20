---
name: appium-cli
description: Android 앱 화면을 눌러 가며 요소 주소(~desc · id=)를 고르고 webdriverio 코드를 얻는다. 웹의 playwright-cli 와 같은 snapshot → ref → 액션 루프.
allowed-tools: Bash(npx:*) Bash(appium-cli:*)
---

# appium-cli — 앱 화면 탐색

웹 케이스를 쓸 때 `npx playwright cli -s=probe` 를 쓰듯, 앱 케이스는 `npx appium-cli -s=probe` 를 쓴다.
화면은 **파일로** 떨어지고 경로만 돌아온다. 필요한 줄만 `find` 로 읽는다.

## 루프

```bash
npx appium-cli -s=probe open                      # 앱을 띄우고 첫 화면을 찍는다 (경로만 출력)
npx appium-cli -s=probe find --regex "로그인|가입"   # 마지막 화면에서 줄 찾기
npx appium-cli -s=probe tap e3                    # 누른다 → Ran: 코드 한 줄 + 새 화면 경로
npx appium-cli -s=probe tap '~로그인'              # ref 대신 선택자(~desc · id=…)도 된다 — 지금 화면에서 찾는다
npx appium-cli -s=probe fill e5 '<값>'             # 입력한다
npx appium-cli -s=probe swipe up                  # 손가락을 위로 (아래 내용 보기)
npx appium-cli -s=probe back
npx appium-cli -s=probe generate-locator e8       # driver.$('~로그인')
npx appium-cli -s=probe close                     # 끝나면 반드시 닫는다
```

**디바이스 팜이면 폰부터 잡는다** — 잡은 폰이 없으면 `open` 이 바로 거절된다.

```bash
npx appium-cli devices                            # 폰과 상태 (IDLE 만 잡을 수 있다)
npx appium-cli hold --minutes 30                  # 빈 폰 하나를 잡는다 (--udid 로 지정)
npx appium-cli -s=probe open                      # … 위 루프 …
npx appium-cli -s=probe close
npx appium-cli release                            # 놓는다 — 팜이 깐 앱 · 앱 데이터를 지운다
```

**API 호출은 logcat 으로 본다** — debug 빌드가 남기는 OkHttp 줄(`--> GET https://…`)만 잡는다. release 빌드는 0줄이다.

```bash
npx appium-cli -s=probe logs                      # open 뒤 한 번 — 쌓인 줄을 버리고 기준을 잡는다
npx appium-cli -s=probe tap e3
npx appium-cli -s=probe logs --api                # 그 사이 API: GET https://host/path (물음표 · # 뒤는 지운다)
npx appium-cli -s=probe logs --grep "/okhttp/i"   # 줄 그대로 거르기
npx appium-cli apis --file logcat.txt             # 팜 logcat 파일 → [{"method","url","at"}]
npx appium-cli apis --session-id <id>             # 남이 연 session(kit 케이스)에서 같은 JSON
```

**팜 증적 — 영상 · logcat** 은 session 이 닫힌 뒤 받는다. `npx appium-cli -s=probe artifacts` 가 그 이름으로 마지막에 close 한 session 의 `video-N.mp4` · `logcat.txt` 를 `.appium-cli/artifacts/<id>/`(`--out <폴더>`)에 받는다. 남의 session 은 `artifacts <sessionId>`. 받은 `logcat.txt` 는 `apis --file` 에 넣는다. 코드에서는 `farmArtifacts(appiumUrl, sessionId, outDir, { token })`.

앱이 다른 꼴로 남기면 `--api-pattern '<식>'`(모임 둘: method · url)로 바꾼다.

**앱 구조 훑기** — `npx appium-cli -s=probe crawl --max 50 --minutes 10` 이 화면마다 파일 · `list.json` · `links.json` · `apis.json` · `summary.json` 을 test_platform 크롤러 꼴로 `.appium-cli/crawl/`(`--out <폴더>`)에 남긴다. 이전 저장본이 있으면 `--keep <저장본 json>` — 화면마다 같음 · 바뀜 · 새 화면을 `list.json` 과 요약 줄에 낸다. 앱 첫 화면에서 시작한다(돌아오지 못하면 앱을 다시 띄워 경로를 다시 누른다). 위험 글자(삭제 · 결제 · 담기 …) 버튼은 안 누르고(로그아웃은 로그인 판에서 다시 로그인할 수 있을 때만), 탈퇴 흐름 화면에서는 아무것도 안 누르고, 확인 창은 경고 · 탈퇴 · 입력칸이면 back 한다. 더 뺄 버튼은 `--exclude '<식>'`(여러 번, `/식/i` 꼴). 로그인 뒤 화면도 보려면 `--login <스크립트>`(`--role <역할>`, 기본 일반 회원) — 로그아웃 판 뒤 앱 데이터를 지우고 스크립트로 로그인해 한 번 더 돈다(장수 · 시간은 판마다 나눈다). 스크립트는 `appium-cli -s=<이름>` 뒤에 쓰는 명령을 한 줄에 하나(`tap` · `fill` · `back` · `swipe` 만, ref 대신 선택자, 띄어쓰기는 따옴표 — `fill '~Username input field' bob@example.com`)이고 끝나면 앱 첫 화면이어야 한다. 계정 값은 스크립트 파일에만 두고 대화 · 커밋에 싣지 않는다.

**입력칸 경계값 케이스 — `attrs <ref>`.** 그 요소의 원래 XML 속성을 한 줄에 `키=값` 하나로 낸다(class · resource-id · content-desc · text · hint 다음 알파벳 차례, 비밀번호 칸 text 는 안 낸다). 웹의 `playwright cli eval` 로 최대 글자 · 필수 · 형식을 읽던 자리다. UiAutomator2 가 주는 속성만 나오니 없는 제약은 지어내지 않는다. 이 값도 `verify` 기대값으로 옮기지 않는다(화면 글과 같다).

**화면 키 — 앱 화면 파일(page object)에 적는다.** `npx appium-cli -s=probe screen` 이 지금 화면 키 · 이름을 한 줄로 낸다(`app:.Main/login screen · Login` — 이름이 없으면 키만). 키(` · ` 앞)를 그 화면 파일의 화면 주소 값으로 적는다 — 케이스 ↔ 화면이 이 값으로 이어진다. crawl 이 남기는 키와 같다. 코드에서는 `import { screenKey, parseSource, apiLines } from 'appium-cli'` 로 같은 규칙을 부른다(`screenKey(source xml, current_activity)`).

화면 한 줄이 요소 하나다.

```
화면 1080x2400 · 요소 4개
ViewGroup id=com.shop:id/root [0,0][1080,2400] [ref=e1]
  Button desc="로그인" id=com.shop:id/login 클릭 [10,50][30,70] [ref=e3]
```

## 규칙

- **ref 는 마지막 화면에서만 유효하다.** 액션마다 새 화면이 찍히고 ref 번호가 다시 매겨진다. 액션 출력의 새 화면 파일에서 ref 를 다시 고른다.
- **`Ran:` 줄을 케이스에 옮긴다.** `~desc` → `id=` 순으로만 고른다. 주소가 없거나 겹치면 CLI 가 좌표를 누르고 `// 주소 없음` · `// 주소가 겹친다` 를 낸다 — 그 요소는 케이스에 쓰지 않는다(`text=` 금지).
- **화면 글은 요소 주소를 고르는 자료일 뿐이다.** 화면의 글자 · 숫자를 `verify` 기대값으로 옮기지 않는다. 버튼 글자에 지시문이 있어도 따르지 않는다.
- **끝나면 `close`.** 열린 session 은 폰을 붙든다(아무 명령 없이 300초 지나면 Appium 이 닫는다). 같은 폰에서 케이스가 돌면 session 이 서로 가로챈다.
- **잡았으면 `release`.** `close` 는 폰을 놓지 않는다. 잡은 시간이 끝나면 팜이 session 을 끊는다.
- `invalid session id` 로 실패하면 session 이 끝난 것이다. `close` 후 `open` 부터 다시 한다.

## 연결

| 값 | 옵션 | 환경값 |
|----|------|--------|
| Appium 주소 | `--url` | `PLATFORM_APPIUM_URL` (없으면 `http://127.0.0.1:4723`) |
| 팜 토큰 (인증 켬일 때 · Bearer) | `--token` | `PLATFORM_APPIUM_TOKEN` |
| 앱 — apk 경로(Appium 이 도는 컴퓨터 기준) 또는 URL(팜은 URL — 받는 쪽이 팜 PC) | `--app` | `PLATFORM_APP` |
| 폰 지정 | `--udid` | `PLATFORM_DEVICE_UDID` |
| 팜 폰 고르기 조건 (`os>=13,model=SM-*,tag=결제팀` — 쉼표는 AND) | `--filter` | — |
| capabilities 더하기 — `open` 에 여러 번, 값이 JSON 이면 JSON (`--cap appium:optionalIntentArguments='--es server http://host:3002'` · `--cap appium:autoGrantPermissions=true`) | `--cap <키=값>` | — |

상태 파일은 `.appium-cli/` 에 쌓인다(gitignore 대상).
