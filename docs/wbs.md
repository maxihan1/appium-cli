# WBS — appium-cli · test_platform 앱 화면 탐색

> **진행판 원본이다.** 형식은 test_platform `docs/wbs.md` 와 같다 — 영역 · 기능 · 태스크, 체크박스만.
> **태스크 하나 = 세션 하나.** 한 세션(1~2시간)에 끝나고 commit · PR 하나로 닫히는 크기다. 넘치면 쪼개 새 번호를 준다.
> **체크는 근거가 있을 때만 찍는다.** 다음 줄에 `  - 근거 <commit 또는 PR> · YYYY-MM-DD`. 순번은 재사용하지 않는다.
> 결정과 까닭은 `context-notes.md`, 계획 원본은 `~/.claude/plans/appium-mcp-test-platform-nifty-pie.md`.

**차례** CLI-F2-01 → F2-02 → F2-03 → F3-01 → F4-01 → TP-1 → TP-2 → TP-3 → TP-4 → TP-5.
TP-1(명세)은 CLI 작업과 따로 먼저 해도 된다.

---

## CLI — appium-cli 저장소 (`~/Projects/Appium_cli`)

### ① 뼈대
**무엇** 웹의 playwright-cli 와 같은 snapshot → ref → 액션 루프를 앱에. daemon 없이 Appium session 번호만 파일에 둔다.
- [x] `CLI-F1-01` v0.1 — open · snapshot · find · tap · fill · swipe · back · screenshot · generate-locator · close · list · 액션마다 `Ran:` 코드 + 새 화면 · `~desc` → `id=` 만 · 에이전트 지침 `skill/SKILL.md` · 테스트 18
  - 근거 commit f146bb1 · 2026-10-20

### ② 디바이스 팜에 붙기
**무엇** Devicefarm(`docs/guides/test-platform.md`)이 요구하는 세 가지 — 토큰 머리 · 폰 잡기 · 기기 고르기. test_platform 작성 컨테이너가 쓸 길이 팜이다.
- [ ] `CLI-F2-01` 토큰 머리 — `--token` · 환경값 → `Authorization: Bearer <pat_…>`. URL 안 계정 → Basic 은 로컬 Appium 용으로 남긴다. 둘 다 오면 토큰이 앞선다. 환경값 이름은 test_platform `APP-F1-10`(kit 토큰 머리)과 맞춘다 — 그쪽이 아직이면 이 태스크에서 정해 그쪽 명세에 넘긴다. 테스트: 헤더 · 우선순위
- [ ] `CLI-F2-02` 폰 잡기 · 놓기 — `hold [--minutes 30|60|120]` · `release` · `devices`(빈 폰 목록). 대상 폰은 `--udid` · `PLATFORM_DEVICE_UDID`, 없으면 `devices` 의 빈 폰 하나. 팜 주소는 Appium 주소에서 `/wd/hub` 를 뗀 것. 409 `refused` 는 이유를 그대로 낸다. `close` 는 폰을 놓지 않는다(사람이 이어 쓸 수 있다) — SKILL.md 에 「hold 했으면 release」 를 적는다. 테스트: fetch 가짜로 요청 순서 · 409
- [ ] `CLI-F2-03` 기기 고르기 · 앱 URL — `--filter` → capabilities `farm:filter`(`os>=13,model=SM-*`). `--app` 은 경로 · URL 둘 다 그대로 넘긴다(팜은 URL — 받는 쪽이 팜 PC). SKILL.md 연결 표 갱신

### ③ 실기기 확인
**무엇** 가짜 fetch 가 아니라 이 맥 팜의 폰(R3CR10TCVCD)으로 끝까지 한 번.
- [ ] `CLI-F3-01` 실기기 E2E — `hold` → MDA apk `open` → 로그인 뒤 두 번째 화면까지 `tap` · `fill` → `generate-locator` → 그 선택자로 `tests/mda` 꼴 케이스를 test_platform 에서 `npx playwright test --project android` 초록 → `close` · `release`. 실측해서 `context-notes.md` 에 적을 것: 팜이 `newCommandTimeout` 300 을 받는지(팜 기본 60초) · 액션 뒤 화면이 전환 중에 찍히는지 · 화면 파일 크기. 나온 작은 고칠 것은 이 태스크에서 고친다 (사용자: apk 경로 · 폰이 비어 있을 것)

### ④ 내보내기
**무엇** test_platform 이 Docker 빌드에서 받을 수 있게 GitHub 저장소로.
- [ ] `CLI-F4-01` GitHub 저장소 · push · 태그 `v0.1.0` · README 한 쪽(설치 · 루프 · 연결 표). `npm i github:<계정>/appium-cli#v0.1.0` 이 `prepare` 로 빌드되는지를 맥과 `node:22` 컨테이너 둘에서 실측 (사용자: 저장소 이름)

---

## TP — test_platform 연동 (`~/Projects/test_platform`)

> test_platform 진행판 `APP-F1-11` 을 세션 크기로 쪼갠 것이다. 시작할 때 그쪽 `docs/wbs.md` 에 새 번호로 옮겨 적고 그쪽 규칙(`/tpx` · 병합된 PR 로만 체크)을 따른다. 여기 체크는 그 PR 이 병합된 뒤 찍는다.

### ⑤ 작성 AI 가 앱을 눌러 가며 읽는다
**무엇** 지금 작성 AI 는 앱 첫 화면 한 장만 본다. appium-cli 로 로그인 뒤 화면까지 보고 `~desc` · `id=` 를 고른다.
- [ ] `TP-1` 명세 먼저 — 작성 §3.6 「앱 화면」에 「로그인 뒤 다른 화면 — appium-cli」 절(도구를 appium-mcp 에서 CLI 로 바꾼 까닭: 토큰 · 컨테이너에 MCP 서버 설정이 없다 · 웹 playwright-cli 와 같은 루프). 정할 것 셋을 사용자와 정한다 — ① 폰은 누가 잡나(에이전트 스크립트가 AI 띄우기 전에 잡고 끝나면 놓기 / AI 가 CLI 로) ② 인증 없음 팜에서 작성 탐색과 정식 실행이 같은 잡힌 폰에 겹칠 때 ③ 첫 화면 파일(`app-screen.txt`)은 남기나. 계약 변경 블록(author 컨테이너 환경값 · 새 의존성)을 모아 승인
- [ ] `TP-2` 의존성 · 지침 — `package.json` devDependency(`github:…#v0.1.0`) · `.claude/skills/appium-cli/` 에 SKILL.md 원본 그대로(playwright-cli 처럼) · `.gitignore` 에 `.appium-cli/`. 검사: `npm ci` 뒤 `npx appium-cli help` · `npm run typecheck` · `npm test`
- [ ] `TP-3` 작성 컨테이너 연결 — `docker-compose` author 에 `PLATFORM_APPIUM_URL=http://host.docker.internal:4723/wd/hub` · 토큰 환경값. 컨테이너 안에서 `npx appium-cli devices` → `hold` → `open` → `close` → `release` 실측
- [ ] `TP-4` 에이전트 · 자식 지침 — `scripts/authoring-agent.ts` 에 TP-1 ①의 결정대로 폰 잡기 · 놓기와 끝난 뒤 남은 session 닫기(`.appium-cli/*.json`) · 프롬프트 `--- 앱 화면 ---` 절에 「appium-cli 를 쓸 수 있다」 · `.claude/skills/tpx-author/references/app.md` §1 · §2 개정(「첫 화면에 없음」 보류 → CLI 로 가서 읽기, 못 가면 그때 보류). 테스트: 에이전트가 끝에 session 을 닫는지
- [ ] `TP-5` 끝까지 한 번 — MDA 서비스에 로그인 뒤 화면을 요구하는 작성 요청 하나 → PR 이 나오고 「⚠️ 폰이 없어 돌려 보지 않은 앱 케이스」 경고가 붙는지 → 병합 뒤 실행 화면에서 폰 러너로 초록. test_platform 진행판 `APP-F1-11` 체크

---

## 지금 안 하는 것
- iOS — `src/platform/ios.ts`(capabilities · XCUITest 화면 파서 · `~name` → `-ios predicate` 순위) 하나로 붙인다. appium-mcp `src/locators` 를 가져오면 NOTICE 를 단다. 팜 · runner 에 iOS 가 생긴 뒤
- test_platform runner `화면을줄인다` 를 appium-cli 에서 가져오기 — 같은 코드가 두 곳이다. TP-5 뒤에 본다
- `hold/extend` — 작성 탐색은 30분 안에 끝난다. 길어지는 실측이 나오면 붙인다
