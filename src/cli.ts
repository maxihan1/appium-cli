// 앱용 playwright-cli. 명령 하나를 Appium 요청으로 바꾸고, session 상태는 .appium-cli/<이름>.json 에 둔다

import { lstat, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, parse, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

import { logcat을읽는다, 가라앉기, 띄우기, 산출물을받는다, 연결주소, 부른다, 요소를찾는다, 좌표를누른다, 화면을기다린다, type 띄운앱, type 연결 } from './appium.js';
import { crawl, 본다 } from './crawl.js';
import { 결과파일들, 상태인가, 저장본모양 } from './crawl-out.js';
import { 기다린다, 길게기본_ms, 길게누른다, 두번누른다, 맞추기, 밀방향인가, 방향말, 방향으로, 상자, 손동작정도, 손짓, 양의정수, 토스트를본다, 토스트줄 } from './gesture.js';
import { 굴려찾기선택자, 먼저뜬다, 보인다, 세어본다, 셈줄, 조회한다 } from './find.js';
import { 키인가, 폰키 } from './input.js';
import { 긋는다, 인자를읽는다, 읽기명령을부른다, 읽기명령이름, 자리들, 점글, 점들을읽는다, 테두리상자, type 상자 as 요소상자 } from './escape.js';
import { apiLines } from './logcat.js';
import { 넣는다, 넣은파일인가, 본다 as 폴더를본다, 지운다, 파일종류인가 } from './file.js';
import { 글자크기, 네트워크, 돌린다, 방향인가, 어두운화면, 위치, 폰상태, 폰시각, type 바꿈 } from './phone.js';
import { 권한목록, 권한바꾼다, 권한이름, 권한창답, 권한창알림, 앞앱줄 } from './system.js';
import { ref로찾는다, 네이티브명령, 맥락들, 웹ref인가, 웹모두찾는다, 웹세어본다, 웹을읽는다, 웹이가라앉을때까지, 웹주소, 웹w3c } from './web.js';
import { capabilities, center, locatorFor, w3c, 패키지이름인가, type 요소 } from './platform/android.js';

const 폴더 = '.appium-cli';

interface 폰 {
  serial: string;
  model?: string;
  osVersion?: string;
  state: string;
  detail?: string;
}

interface 세션 {
  sessionId: string;
  snapshot: string | null;
  refs: Record<string, 요소>;
  width: number;
  height: number;
  // 첫 logs 가 쌓인 줄을 버렸는지 — 그 뒤로는 Appium 이 새 줄만 준다
  logcat읽음?: boolean;
  // attach 로 남의 session(kit 케이스)에 붙었다 — close 가 그 session 을 닫지 않는다
  붙음?: boolean;
  // open 이 띄운 앱 꾸러미 · activity · intent 인자 — app restart · clear · crawl --login 이 이것으로 다시 띄운다
  앱?: 띄운앱;
  // context 로 바꾼 웹뷰 맥락 이름 — 없으면 네이티브. 웹 화면의 ref(wN)는 페이지 요소에 단 표라 여기 두지 않는다
  맥락?: string;
}

export const 도움말 = `appium-cli [-s=<session>] <명령> [인자]

  open [--app <apk|URL|패키지>] [--udid <id>] [--filter <조건>] [--cap <키=값>]   앱을 띄우고 첫 화면을 찍는다
                                     --cap 은 capabilities 에 더한다 (여러 번 · 값이 JSON 이면 JSON · 기본값을 덮는다)
  attach <sessionId>                 남이 연 session(kit 케이스)에 붙어 지금 화면을 찍는다 — close 는 그 session 을 안 닫는다
                                     붙은 session 의 logs · crawl 은 --force 가 있어야 한다 (logcat 새 줄을 가로채 케이스 쪽에서 사라진다)
  snapshot [--raw]                   화면을 파일로 떨군다 (--raw 면 글을 그대로)
  find <글자> | --regex <식>           마지막 화면에서 줄을 찾는다
  tap <ref|선택자>                     누른다 (click 도 같다). 선택자 '~desc' · 'id=…' · 'android=…'(부모 꼴 · 뜨는 창 꼴) 는 지금 화면에서 찾는다
                                     tap · long-press · double-tap · tap-xy · 손동작(swipe-in · drag · pinch-…)은 누른 뒤 기다리는 동안 본 토스트를 끝에 Toast: 「글」 줄로 덧붙인다
  long-press <ref|선택자> [--ms 1200]   요소를 길게 누른다 — 케이스와 같은 동작 (Ran: await 길게누르기(driver, '<선택자>'))
  double-tap <ref|선택자>              같은 자리를 짧게 두 번 (Ran: await 두번누르기(await driver.$('<선택자>').getElement()))
  wait <선택자> | --text <글자> [--gone] [--timeout 10000]
                                     그 요소(--text 면 그 글자를 가진 요소)가 뜰 때까지 (--gone 이면 사라질 때까지) 화면을 되풀이해 읽는다
                                     뜨면 걸린 ms 와 새 화면 경로, 시간 안에 안 되면 까닭 한 줄과 종료 코드 1 (Ran: await 뜰때까지 · 사라질때까지(driver, '<선택자>'))
  wait-any <선택자> <선택자>… [--timeout 30000]   후보 가운데 먼저 보이는 것 — Found: <선택자> 와 새 화면 (Ran: await 먼저뜨는것(driver, { … })). 없으면 종료 코드 1
  count <선택자>                       지금 화면을 찍고 그 선택자가 몇 개 맞나 · 맞은 자리마다 같은 자리의 ref — 하나만 맞아야 케이스에 쓴다
  visible <선택자>                     기다리지 않고 지금 보이나 (Ran: await 보이나(driver, '<선택자>'))
  scroll-to <글자>                     굴릴 수 있는 첫 목록을 그 글자가 보일 때까지 굴린다 (Ran: await 스크롤해서찾기(driver, '<글자>'))
  toast [--timeout 5000]             지금부터 그 시간 동안 화면을 읽어 Toast · 스낵바 글을 Toast: 「글」 한 줄씩 낸다 — 못 봤으면 종료 코드 1 (누른 바로 뒤에 부른다)
  fill <ref|선택자> <값> [--submit]     입력한다 (--submit 이면 넣은 뒤 키보드 완료(IME done)를 보낸다)
  clear <ref|선택자>                   칸을 비운다 (Ran: await 칸비우기(await driver.$('<선택자>').getElement()))
  press home|recent|delete|tab|paste   폰 키를 누른다 — 홈 · 최근 앱 · 지우기 · 탭 · 붙여 넣기 (Ran: await 키누르기(driver, '홈'))
                                     키보드 완료는 fill --submit, 뒤로는 back
  type <글>                           포커스가 있는 칸에 키를 하나씩 친다 — 인증번호 여섯 칸 · 앱이 그린 키패드 (Ran: await 포커스칸에치기(driver, '<글>'))
                                     칸을 먼저 tap 한다
  clipboard [write <글>]              클립보드를 읽는다 · 쓴다 (Ran: await 클립보드읽기(driver) · 클립보드쓰기(driver, '<글>')). 붙여 넣기는 press paste
  hide-keyboard                      키보드를 내린다 (아래 버튼을 가릴 때)
  swipe up|down|left|right           손가락을 그 방향으로 민다 (화면 전체)
  swipe-in <ref|선택자> up|down|left|right   그 요소 안에서만 민다 — 가로 상품 줄 · 밀어서 삭제 · 아래 시트 · 슬라이더 · 날짜 고르개
                                     (Ran: await 요소안에서밀기(driver, '<선택자>', '위' | '아래' | '왼쪽' | '오른쪽'))
  drag <ref|선택자> <ref|선택자>        앞 요소를 눌러 뒤 요소 가운데로 끌어 놓는다 (Ran: await 끌어놓기(driver, '<어디서>', '<어디로>'))
  pinch-open | pinch-close <ref|선택자>   그 요소에서 두 손가락을 벌린다 · 오므린다 — 지도 · 사진 확대 축소 (Ran: await 벌리기 · 오므리기(driver, '<선택자>'))
  draw <ref|선택자> <x,y> [<x,y> …]     그 요소 안 %(0~100) 자리를 누른다(점 하나) · 누른 채 이어 긋는다(점 여럿) — 서명 칸 · 패턴 잠금 · 그림판
                                     (Ran: await 요소위에그리기(driver, '<선택자>', [[x, y], …])). 지도 핀은 확대마다 자리가 달라 쓰지 않는다
  exec <mobile: 이름> [JSON]          읽기만 하는 Appium 명령을 부른다 — 살펴보기 전용, 케이스에 옮기지 않는다
                                     (getCurrentActivity · getCurrentPackage · getNotifications · getSystemBars · getDisplayDensity · getAppStrings ·
                                      isAppInstalled · queryAppState · getContexts · deviceInfo · batteryInfo). 폰 셸과 CLI 명령 · kit 부품이 있는 것은 거절한다
  tap-xy <x> <y>                     좌표를 누른다 — 눌러 보기만. 케이스에 옮길 Ran 줄을 내지 않는다(요소가 없는 자리는 케이스에서 보류다)
  back                               뒤로
  screenshot [ref|선택자] [--filename <파일>]   스크린샷 (ref · 선택자를 주면 그 요소만)
  info                               앱이 떠 있나 · 지금 화면 · 키보드 · 폰 기종 · 배터리
  settings [키=값 …]                  드라이버 설정을 보거나 바꾼다 (값이 JSON 이면 JSON). 붙은 session 은 바꾸기에 --force
                                     waitForIdleTimeout 은 케이스에서 움직이는화면에서 구간으로 쓴다 — Ran 줄이 그 꼴을 알려 준다
  generate-locator <ref|선택자>        webdriverio 선택자 — 선택자를 주면 지금 화면에서 하나만 맞을 때만 내고 맞은 자리의 ref 를 붙인다
  attrs <ref>                        그 요소의 원래 XML 속성 (한 줄에 키=값 · 비밀번호 칸 text 는 안 낸다)
  screen                             지금 화면 키 · 이름 (crawl 과 같은 키 — 앱 화면 파일의 화면 주소 값)
  app restart | clear                앱을 다시 띄운다 (clear 는 앱 데이터를 지운 뒤) — open 의 intent 인자(optionalIntentArguments)를 다시 싣는다
                                     (Ran: await 앱다시켜기(driver, '<꾸러미>') · 앱비우기(driver) · 인자가 있으면 인자로켜기(driver, { … }) · 앱비우기(driver, { … }))
                                     붙은 session 은 --force 가 있어야 한다 (남의 앱을 다시 띄운다)
  app front                          다른 앱 · 시스템 화면을 본 뒤 시험 대상 앱을 다시 앞에 둔다 (Ran: await driver.activateApp('<꾸러미>'))
                                     화면이 시험 대상 앱이 아니면 snapshot 끝에 「- 앞 앱: <꾸러미>」 줄이 붙는다
  permission [grant|revoke <권한…>]   시험 대상 앱의 권한 — 인자가 없으면 요청한 권한마다 줌 · 안 줌, grant · revoke 는 창 없이 주고 뺀다
                                     (CAMERA 처럼 줄여도 된다 · Was: 앞 상태 · 되돌릴 명령). revoke 하면 Android 가 앱을 꺼서 다시 띄운다
                                     케이스에서는 권한상태에서(driver, { 준다 · 뺀다 }, async () => { … }) 구간으로 쓴다
                                     권한 창의 허용 · 거부 단추를 tap 하면 Ran: await 권한창답하기(driver, '허용' | '거부')
  background <초>                      앱을 그 초만큼 뒤로 보냈다 돌아온다 — 다시 앞에 올 때 화면 · 입력이 남나 (Ran: await 뒤로보냈다오기(driver, <초>))
  deeplink <주소>                      딥 링크로 시험 대상 앱의 그 화면을 연다 (Ran: await 딥링크열기(driver, '<주소>'))
  screen-off-on                      화면을 껐다 켠다(잠금 · 풀기) — 잠금 화면에 PIN 이 걸린 폰은 못 푼다 (Ran: await 화면껐다켜기(driver))
  reinstall                          시험 대상 앱을 지우고 open 의 앱 파일을 다시 깐 뒤 띄운다 — 처음 깐 상태 (Ran: await 앱다시깔기(driver))
                                     패키지 이름으로 연 스토어 앱은 지우지 않는다. 붙은 session 은 --force
                                     옛 판에서 새 판으로 올리기는 케이스에서만 — 옛판에서올리기(driver, async () => { … }) 구간(옛 판은 빌드 목록의 앞 빌드)
  phone                              폰 상태 — 화면 방향 · 와이파이 · 모바일 데이터 · 어두운 화면 · 글자 크기 · 시각
  phone rotate landscape|portrait    화면을 돌린다
  phone network off|on               와이파이 · 모바일 데이터를 끊는다 · 켠다 (Appium 연결은 USB 라 살아 있다)
  phone location <위도> <경도> | reset   가짜 위치를 둔다 · 거둔다 (음수는 -- 뒤에: phone location -- -33.86 151.21)
  phone dark on|off                  어두운 화면
  phone font <배율>                   글자 크기 (1 이 기본 · 폰 셸이라 팜이 adb_shell 을 열어야 한다)
                                     바꾸면 Was: 앞 상태 · 되돌릴 명령 · 새 화면. 케이스에서는 폰상태에서(driver, { … }, async () => { … }) 구간으로 쓴다
                                     폰 언어 · 시간대는 팜 기준값이라 바꾸지 않는다. 붙은 session 은 바꾸기에 --force
  phone time [<꼴>]                   폰 시각 — 꼴은 YYYY-MM-DD 처럼 (Ran: await 폰시각(driver))
  file push 사진|영상|파일 [--size <바이트>]   폰 사진첩 · 영상 · 다운로드에 qa- 이름으로 넣는다 — 고르기 화면에서 그 이름으로 고른다
                                     (Ran: const 파일 = await 폰에파일넣기(driver, '사진') — 케이스는 finally 에서 파일.지우기())
  file ls <폴더> [<이름>]              폴더의 파일 이름들 — 이름을 주면 있나만 (Ran: await 폰파일있나(driver, '<폴더>', '<이름>'))
                                     앱이 받은 파일을 본다. 폴더가 없으면 빈 목록
  file rm <경로>                      file push 로 넣은 파일(qa- 이름)만 지운다
  notifications                      알림 창을 내리고 찍는다 (Ran: await 알림창열기(driver)) — 푸시는 tap, 닫기는 back
  record start | stop [--out <파일.mp4>]   화면 녹화 (로컬 Appium 용 — 팜은 artifacts 의 video-N.mp4)
  contexts                           앱 안 웹 화면(웹뷰) 맥락 목록 — 지금 맥락에 (지금). 앱이 웹뷰 디버깅을 켠 빌드라야 WEBVIEW_… 가 보인다
  context <이름>                       그 맥락으로 바꾸고 화면을 찍는다 (WEBVIEW_… 이면 웹 화면 · NATIVE_APP 이면 돌아온다). 붙은 session 은 --force
                                     웹 화면 줄은 [ref=wN] 이고 선택자는 웹 케이스 순서의 WebdriverIO 꼴이다
                                     ('[data-testid="…"]' · 'aria/이름' · 'input[placeholder="…"]' · 'button=글' · CSS · XPath)
                                     웹 맥락에서 쓰는 것: snapshot · find · tap · fill · clear · clipboard · wait · visible · count · generate-locator · screenshot · back · info · logs · settings · record · close
  close                              session 을 닫는다 (번호를 남겨 artifacts 가 쓴다)
  list                               열린 session 목록
  logs [--grep <식>] [--api]          logcat 새 줄 (첫 호출은 쌓인 줄을 버린다) · --api 면 API 줄만 METHOD URL
  apis --session-id <id> | --file <logcat.txt>   남이 연 session · 팜 logcat 파일에서 API 를 [{method,url,at}] JSON 으로
  artifacts [sessionId] [--out <폴더>]   팜이 session 마다 남긴 영상 · logcat.txt 를 받는다
                                     (sessionId 가 없으면 이 이름으로 마지막에 close 한 session · 기본 .appium-cli/artifacts/<id>/)
  crawl [--max 50] [--minutes 10] [--exclude <식>] [--out <폴더>] [--keep <저장본>] [--login <스크립트> [--role <역할>]]
                                     지금 화면부터 눌러 가며 화면 파일 · list · index · links · apis · summary.json 을
                                     --out(기본 .appium-cli/crawl)에. --keep 이면 저장본과 같음 · 바뀜 · 새 화면
                                     --max 0 · --minutes 0 은 상한 없음 — 장수 · 시간으로 안 멈추고 아래 화면당 상한만으로 끝난다
                                     시작 때 --out 의 지난 결과(로그아웃/ · 로그인/ · 결과 json)만 지운다 (뿌리 · 홈 · 작업 폴더나 그 위는 거절)
                                     위험 글자(삭제 · 결제 …) · --exclude 에 맞는 이름은 안 누른다 (--exclude 는 여러 번)
                                     화면 후보를 다 누르면 목록(스크롤 요소)을 위로 밀어 새 후보도 누른다 (화면당 다섯 번 · 누름 30 번까지)
                                     못 돌아오면 이미 본 연결로 가 보고, 안 되면 앱을 다시 띄워 경로를 다시 누른다
                                     --login 이면 로그아웃 판 뒤 앱 데이터를 지우고 스크립트로 로그인해 로그인:<역할>(기본 일반 회원) 판을 돈다
                                     로그아웃은 로그인 판에서 다시 로그인할 수 있을 때만 누른다 (다시 로그인은 세 번까지)
                                     스크립트는 한 줄에 tap · fill · back · swipe · hide-keyboard 하나 (선택자는 따옴표로: fill '~Username input field' bob)

디바이스 팜 (session 을 열기 전에 폰을 잡는다)
  devices                            팜의 폰과 상태
  hold [--udid <serial>] [--app <패키지>] [--minutes 30|60|120]   폰을 잡는다 (udid 가 없으면 빈 폰 하나)
                                     앱(--app · PLATFORM_APP)이 패키지 이름이면 그 앱이 깔린 빈 폰만 고른다
  release [--udid <serial>]          폰을 놓는다 — 팜이 깐 앱 · 앱 데이터를 정리한다

연결: --url 또는 PLATFORM_APPIUM_URL (없으면 http://127.0.0.1:4723)
토큰: --token 또는 PLATFORM_APPIUM_TOKEN (팜이 인증을 켰을 때 — Bearer)
앱:   --app 또는 PLATFORM_APP (팜은 URL — 받는 쪽이 팜 PC · 폰에 스토어로 깐 앱은 패키지 이름 com.shop.app — 깔지 않고 켠다) · 폰: --udid 또는 PLATFORM_DEVICE_UDID
팜 폰 고르기: --filter 'os>=13,model=SM-*' (쉼표는 AND)
API 꼴: --api-pattern <식> (모임 둘: method · url — 기본은 OkHttp '--> GET https://…'). 물음표 · # 뒤는 지운다`;

const 따옴표 = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** startActivity 로 띄우는 intent 인자를 kit 인자로켜기 · 앱비우기 가 받는 `{ 이름: '값' }` 꼴로 — kit 은 글 인자(-e · --es)만 받아 다른 꼴이 끼면 null */
function 인자꼴(arg: Record<string, unknown>): string | null {
  const extras = arg.extras as string[][];
  if (!extras.every((e) => e[0] === 's')) return null;
  return `{ ${extras.map(([, k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k!) ? k! : 따옴표(k!)}: ${따옴표(v!)}`).join(', ')} }`;
}

// playwright-cli 처럼 `/식/i` 로 플래그를 붙인다 — JS 정규식은 `(?i)` 를 모른다
function 정규식(s: string): RegExp {
  const 꼴 = /^\/(.+)\/([a-z]*)$/.exec(s);
  // g · y 는 test() 가 lastIndex 를 남겨 다음 줄을 건너뛴다 — 줄마다 거르는 데는 뺀다
  return 꼴 ? new RegExp(꼴[1]!, 꼴[2]!.replace(/[gy]/g, '')) : new RegExp(s);
}

function API꼴(s: string | undefined): RegExp | undefined {
  if (s === undefined) return undefined;
  const 식 = 정규식(s);
  // 빈 글에 맞는 갈래를 붙여 모임 수를 센다
  if (new RegExp(`${식.source}|`).exec('')!.length < 3) throw new Error('--api-pattern 에는 모임 둘(method · url)이 있어야 한다');
  return 식;
}

// 로그인 스크립트에 쓸 수 있는 명령 — 앱 안에서 누르고 넣는 것만 (open · close · crawl 은 session 을 바꾼다)
const 스크립트명령 = new Set(['tap', 'click', 'fill', 'back', 'swipe', 'hide-keyboard']);

// ref 대신 선택자(`~desc` · `id=…` · `android=…`)도 받는다 — 로그인 스크립트처럼 ref 번호를 모르고 쓸 때.
// `android=` 는 test_platform 케이스 규칙의 부모 꼴 · 뜨는 창 꼴(UiSelector)이다
const 선택자인가 = (x: string | undefined): x is string => x !== undefined && /^(?:~|id=|android=)./.test(x);

/** 로그인 스크립트 — 한 줄이 `appium-cli -s=<이름>` 뒤에 쓰는 명령 하나. 따옴표로 띄어쓰기를 묶고, 빈 줄 · `#` 줄은 건너뛴다. tap · fill 은 선택자만 (ref 는 화면마다 바뀐다) */
function 스크립트읽기(글: string): string[][] {
  const 줄들 = 글.split(/\r?\n/).flatMap((줄, i) => {
    const 낱 = [...줄.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]!);
    if (낱.length === 0 || 낱[0]!.startsWith('#')) return [];
    if (!스크립트명령.has(낱[0]!)) throw new Error(`로그인 스크립트 ${i + 1}줄: ${낱[0]} 은 못 쓴다 — tap · fill · back · swipe · hide-keyboard 만`);
    if (['tap', 'click', 'fill'].includes(낱[0]!) && !선택자인가(낱[1])) throw new Error(`로그인 스크립트 ${i + 1}줄: ref 대신 선택자('~desc' · 'id=…' · 'android=…')를 쓴다`);
    // 따옴표 없는 UiSelector 는 빈칸에서 잘린다 — 잘린 앞조각도 android= 로 시작해 위를 지나간다
    if (낱[1]?.startsWith('android=') === true && !낱[1].endsWith(')')) throw new Error(`로그인 스크립트 ${i + 1}줄: android= 선택자는 따옴표로 묶는다`);
    return [낱];
  });
  if (줄들.length === 0) throw new Error('로그인 스크립트가 비었다');
  return 줄들;
}

// --cap · settings 키=값 — 첫 = 에서 가른다(값에 = 가 들어간다). 값이 JSON(true · 5 · ["a"] · "따옴표")이면 그 값, 아니면 글 그대로
function 캡읽기(쌍들: string[], 이름 = '--cap'): Record<string, unknown> {
  return Object.fromEntries(
    쌍들.map((쌍) => {
      const i = 쌍.indexOf('=');
      if (i < 1) throw new Error(`${이름} 은 키=값 꼴이다(키가 비면 안 된다): ${쌍}`);
      const 값 = 쌍.slice(i + 1);
      try {
        return [쌍.slice(0, i), JSON.parse(값) as unknown];
      } catch {
        return [쌍.slice(0, i), 값];
      }
    }),
  );
}

/**
 * crawl 이 지난 실행에 쓴 것(상태 폴더 · 결과 json)만 지운다 — 남은 `NNN.yml` 이 이번 화면과 섞이지 않게. 폴더 안 다른 파일은 둔다.
 * 파일 시스템 뿌리 · 홈 · 작업 폴더나 그 위 폴더는 거절한다(test_platform 크롤러와 같은 뜻 — 기본 .appium-cli/crawl 은 작업 폴더 아래라 받는다).
 * 상태 폴더가 symlink 면 따라가지 않고 거절한다. 거절은 지우기 전에 다 본다
 */
async function 지난결과를지운다(출력: string): Promise<void> {
  // ponytail: realpath 는 안 본다 — /var · /private/var 처럼 이름만 다른 같은 곳은 못 가린다(지우는 것이 크롤 산출물뿐이라 둔다)
  const 곳 = resolve(출력);
  const 여기 = process.cwd();
  if (곳 === parse(곳).root || 곳 === resolve(homedir()) || 여기 === 곳 || 여기.startsWith(곳 + sep)) {
    throw new Error(`--out 이 뿌리 · 홈 · 작업 폴더나 그 위 폴더다 — 그 아래 폴더를 준다: ${출력}`);
  }
  for (const 상태폴더 of ['로그아웃', '로그인']) {
    if (await lstat(join(곳, 상태폴더)).then((x) => x.isSymbolicLink(), () => false)) throw new Error(`--out 의 ${상태폴더} 폴더가 symlink 다 — 따라가 지우지 않는다: ${join(출력, 상태폴더)}`);
  }
  for (const 이름 of ['로그아웃', '로그인', 'index.json', 'list.json', 'links.json', 'apis.json', 'summary.json']) await rm(join(곳, 이름), { recursive: true, force: true });
}

async function 읽는다(파일: string): Promise<세션> {
  try {
    return JSON.parse(await readFile(파일, 'utf8')) as 세션;
  } catch {
    throw new Error('열린 session 이 없다 — open 부터 한다');
  }
}

const 적는다 = (파일: string, s: 세션): Promise<void> => writeFile(파일, JSON.stringify(s, null, 2));

async function 찍는다(c: 연결, s: 세션, raw: boolean, 앞?: string, 토스트봄 = false): Promise<string> {
  if (s.맥락 !== undefined) {
    const 웹 = 앞 === undefined ? await 웹을읽는다(c, s.sessionId, s.맥락) : await 웹이가라앉을때까지(c, s.sessionId, s.맥락, 앞, 가라앉기.최대_ms, 가라앉기.간격_ms);
    const 파일 = join(폴더, `web-${Date.now()}.txt`);
    await writeFile(파일, 웹);
    // 네이티브 ref 는 웹 맥락에서 못 쓴다 — 비워서 eN 을 주면 「마지막 화면에 없다」가 나오게 한다
    Object.assign(s, { snapshot: 파일, refs: {} });
    return raw ? 웹 : `- Snapshot: ${파일}`;
  }
  const 화면 = await 화면을기다린다(c, s.sessionId, 앞, 토스트봄);
  const 파일 = join(폴더, `screen-${Date.now()}.txt`);
  await writeFile(파일, 화면.글);
  Object.assign(s, { snapshot: 파일, refs: 화면.refs, width: 화면.width, height: 화면.height });
  return [raw ? 화면.글 : `- Snapshot: ${파일}`, ...(화면.기다림?.잠깐 ?? []).map(토스트줄), 앞앱줄(화면.refs, s.앱?.appPackage)].filter((x) => x !== null).join('\n');
}

function 고른다(s: 세션, ref: string | undefined): { el: 요소; loc: string | null; 겹침: number } {
  const el = ref === undefined ? undefined : s.refs[ref];
  if (el === undefined) throw new Error(`ref ${ref ?? '(없음)'} 가 마지막 화면에 없다 — snapshot 을 다시 찍고 거기 ref 를 쓴다`);
  const loc = locatorFor(el);
  const 겹침 = loc === null ? 0 : Object.values(s.refs).filter((e) => locatorFor(e) === loc).length;
  return { el, loc, 겹침 };
}

// tap · fill 대상 — 선택자면 마지막 화면을 안 보고 그대로 쓴다
function 대상(s: 세션, x: string | undefined): { el: 요소 | null; loc: string | null; 막힘: string | null } {
  if (선택자인가(x)) return { el: null, loc: x, 막힘: null };
  const { el, loc, 겹침 } = 고른다(s, x);
  return { el, loc, 막힘: 선택자글(loc, 겹침) };
}

// 찾기_ms 동안 다시 해 본다 — 앱이 막 떴거나(로그인 스크립트 첫 줄) 좌표를 누른 뒤 입력칸이 아직 안 잡혔을 때
async function 될때까지(일: () => Promise<string>, 실패: string): Promise<string> {
  const 끝 = Date.now() + 가라앉기.찾기_ms;
  for (;;) {
    try {
      return await 일();
    } catch (e) {
      if (Date.now() >= 끝) throw new Error(`${실패} — ${e instanceof Error ? e.message : String(e)}`);
      await new Promise((ok) => setTimeout(ok, 가라앉기.간격_ms));
    }
  }
}

const 찾는다 = (c: 연결, sid: string, loc: string): Promise<string> => 될때까지(() => 요소를찾는다(c, sid, w3c(loc).using, w3c(loc).value), `${loc} 를 지금 화면에서 못 찾았다`);
const 웹찾는다 = (c: 연결, sid: string, loc: string): Promise<string> => {
  const { using, value } = 웹w3c(loc);
  return 될때까지(() => 요소를찾는다(c, sid, using, value), `${loc} 를 지금 웹 화면에서 못 찾았다`);
};

// 웹 맥락에서 받은 인자 — 네이티브 ref(eN)는 바로 거절한다(CSS 로 읽혀 10초를 헛기다리지 않게)
function 웹인자(x: string | undefined): string {
  if (x === undefined || x === '') throw new Error('ref(wN)나 선택자가 필요하다');
  if (/^e\d+$/.test(x)) throw new Error(`${x} 는 네이티브 화면의 ref 다 — 웹 화면은 wN 이다. snapshot 을 다시 찍는다`);
  return x;
}

// 웹 맥락의 tap · fill · screenshot 대상 — ref 면 그때 고른 선택자로, 고를 것이 없는 ref 면 화면을 찍을 때 단 표로 찾는다
async function 웹대상(c: 연결, sid: string, x: string | undefined): Promise<{ id: string; loc: string | null; 까닭?: string }> {
  const 인자 = 웹인자(x);
  if (!웹ref인가(인자)) return { id: await 웹찾는다(c, sid, 인자), loc: 인자 };
  const r = await 웹주소(c, sid, 인자);
  if (r.loc !== null) return { id: await 웹찾는다(c, sid, r.loc), loc: r.loc };
  return { id: await ref로찾는다(c, sid, 인자), loc: null, ...(r.까닭 === undefined ? {} : { 까닭: r.까닭 }) };
}

// 찾는 도중 페이지가 넘어가면 찾기가 실패한다 — 그때는 모름(undefined)으로 두고 기다리기가 다시 본다
async function 웹보인다(c: 연결, sid: string, 선택자: string): Promise<boolean | undefined> {
  const ids = await 웹모두찾는다(c, sid, 선택자).catch(() => undefined);
  if (ids === undefined) return undefined;
  if (ids[0] === undefined) return false;
  return 부른다(c, 'GET', `/session/${sid}/element/${ids[0]}/displayed`).then(
    (v) => v === true,
    () => false,
  );
}

// 붙은 session 은 케이스가 웹뷰에서 구간을 드나드니 명령마다 지금 맥락을 다시 묻는다. 못 물으면 네이티브로 본다 — context 를 모르는 Appium 앞단에서도 붙게
async function 맥락을맞춘다(c: 연결, s: 세션): Promise<void> {
  const 지금 = await 부른다(c, 'GET', `/session/${s.sessionId}/context`).catch(() => 'NATIVE_APP');
  if (typeof 지금 === 'string' && 지금 !== '' && 지금 !== 'NATIVE_APP') s.맥락 = 지금;
  else delete s.맥락;
}

// 케이스에 옮겨 쓸 수 있는 선택자만 코드로 낸다. 없거나 겹치면 까닭을 적는다 (test_platform tpx-author/references/app.md §2)
function 선택자글(loc: string | null, 겹침: number): string | null {
  if (loc === null) return '주소 없음 — desc 도 id 도 없다. text= 로 찾지 않는다';
  if (겹침 > 1) return `주소가 겹친다 — 화면에 ${loc} 가 ${겹침}개다`;
  return null;
}

export async function run(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      session: { type: 'string', short: 's' },
      url: { type: 'string' },
      token: { type: 'string' },
      app: { type: 'string' },
      udid: { type: 'string' },
      raw: { type: 'boolean' },
      regex: { type: 'boolean' },
      filename: { type: 'string' },
      minutes: { type: 'string' },
      filter: { type: 'string' },
      cap: { type: 'string', multiple: true },
      grep: { type: 'string' },
      api: { type: 'boolean' },
      'api-pattern': { type: 'string' },
      'session-id': { type: 'string' },
      file: { type: 'string' },
      max: { type: 'string' },
      exclude: { type: 'string', multiple: true },
      out: { type: 'string' },
      keep: { type: 'string' },
      login: { type: 'string' },
      role: { type: 'string' },
      submit: { type: 'boolean' },
      force: { type: 'boolean' },
      ms: { type: 'string' },
      text: { type: 'string' },
      gone: { type: 'boolean' },
      timeout: { type: 'string' },
      size: { type: 'string' },
    },
  });
  const [명령, ...인자] = positionals;
  if (명령 === undefined || 명령 === 'help') return 도움말;

  // -s=probe 도 받는다 (playwright-cli 와 같은 꼴)
  const 이름 = (values.session ?? 'default').replace(/^=/, '');
  if (!/^[\w-]+$/.test(이름)) throw new Error(`session 이름은 글자 · 숫자 · _ · - 만 쓴다: ${이름}`);
  await mkdir(폴더, { recursive: true });
  const 파일 = join(폴더, `${이름}.json`);
  // 마지막에 close 한 session 번호 — artifacts 가 번호 없이 받는다
  const 마지막 = join(폴더, `${이름}.last`);

  if (명령 === 'list') {
    const 이름들 = (await readdir(폴더)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
    return 이름들.length === 0 ? '열린 session 이 없다' : 이름들.join('\n');
  }

  const c = 연결주소(values.url ?? env.PLATFORM_APPIUM_URL ?? 'http://127.0.0.1:4723', values.token ?? env.PLATFORM_APPIUM_TOKEN);

  // 잡기 주소는 Appium 주소에서 /wd/hub 를 뗀 곳에 있다 (Devicefarm docs/guides/test-platform.md §4)
  const 팜 = { ...c, base: c.base.replace(/\/wd\/hub$/, '') };
  const 잡은폰 = join(폴더, 'held');
  if (명령 === 'devices') {
    const v = (await 부른다(팜, 'GET', '/api/devices')) as { devices?: 폰[] } | null;
    const 폰들 = v?.devices ?? [];
    if (폰들.length === 0) return '팜에 꽂힌 폰이 없다';
    return 폰들.map((p) => `${p.serial} ${p.model ?? '?'} Android ${p.osVersion ?? '?'} ${p.state}(${p.detail ?? ''})`).join('\n');
  }
  if (명령 === 'hold') {
    const 분 = Number(values.minutes ?? 30);
    if (![30, 60, 120].includes(분)) throw new Error('--minutes 는 30 · 60 · 120 중 하나다');
    let serial = values.udid ?? env.PLATFORM_DEVICE_UDID;
    if (!serial) {
      // 스토어 앱이면 놓을 때도 그 앱이 남는 폰만 — 팜 「남길 앱」(Devicefarm docs/guides/test-platform.md §11 「스토어 앱」)
      const app = values.app ?? env.PLATFORM_APP;
      // 깔린 폰 전부를 한 번에 받아 빈 폰을 여기서 고른다 — 「깔린 폰 없음」과 「빈 폰 없음」을 같은 답으로 가른다
      const 꾸러미 = app !== undefined && 패키지이름인가(app) ? app : null;
      if (꾸러미 === null) {
        const v = (await 부른다(팜, 'GET', '/api/devices?status=idle')) as { devices?: 폰[] } | null;
        serial = v?.devices?.[0]?.serial;
        if (!serial) throw new Error('잡을 수 있는 빈 폰이 없다 — devices 로 상태를 본다');
      } else {
        const v = (await 부른다(팜, 'GET', `/api/devices?app=${encodeURIComponent(꾸러미)}`)) as { devices?: 폰[] } | null;
        const 깔린 = v?.devices ?? [];
        if (깔린.length === 0) throw new Error(`팜에 ${꾸러미} 이 깔린 폰이 없다 — 사람이 원격 화면에서 스토어로 깔고 「남길 앱」에 넣어야 한다`);
        serial = 깔린.find((p) => p.state === 'IDLE')?.serial;
        if (!serial) throw new Error(`${꾸러미} 이 깔린 빈 폰이 없다 — devices 로 상태를 본다`);
      }
    }
    const v = (await 부른다(팜, 'POST', `/api/devices/${encodeURIComponent(serial)}/hold`, { minutes: 분 })) as { held?: { until?: number } } | null;
    await writeFile(잡은폰, serial);
    const 끝 = v?.held?.until === undefined ? '' : ` — ${new Date(v.held.until).toTimeString().slice(0, 5)} 까지`;
    return `폰 ${serial} 잡음${끝}. 다 쓰면 close 뒤 release`;
  }
  if (명령 === 'release') {
    const serial = values.udid ?? env.PLATFORM_DEVICE_UDID ?? (await readFile(잡은폰, 'utf8').catch(() => '')).trim();
    if (!serial) throw new Error('놓을 폰을 모른다 — --udid 로 준다');
    await 부른다(팜, 'DELETE', `/api/devices/${encodeURIComponent(serial)}/hold`);
    await rm(잡은폰, { force: true });
    return `폰 ${serial} 놓음 — 팜이 깐 앱 · 앱 데이터를 정리한다`;
  }

  // 케이스 ↔ API — kit 케이스가 연 session 이나 팜이 session 마다 남긴 logcat 파일을 읽는다. CLI session 파일은 안 쓴다
  if (명령 === 'apis') {
    const sid = values['session-id'];
    const 줄 = values.file !== undefined ? (await readFile(values.file, 'utf8')).split(/\r?\n/) : sid !== undefined ? await logcat을읽는다(c, sid) : null;
    if (줄 === null) throw new Error('apis 에 --session-id <id> 나 --file <logcat.txt> 가 필요하다');
    return JSON.stringify(apiLines(줄, API꼴(values['api-pattern'])));
  }

  // 팜 산출물 — 닫힌 session 도 받는다(30일 보관). CLI session 파일은 안 쓴다
  if (명령 === 'artifacts') {
    const sid = 인자[0] ?? (await readFile(마지막, 'utf8').catch(() => '')).trim();
    if (!sid) throw new Error(`받을 session 을 모른다 — artifacts <sessionId> 로 주거나 -s=${이름} 으로 close 를 먼저 한다`);
    if (!/^[\w-]+$/.test(sid)) throw new Error(`session 번호는 글자 · 숫자 · _ · - 만 쓴다: ${sid}`);
    const { files, errors } = await 산출물을받는다(c, sid, values.out ?? join(폴더, 'artifacts', sid));
    const 줄 = [...files.map((f) => `- ${f.name} ${f.bytes} bytes: ${f.path}`), ...errors.map((e) => `팜 오류: ${e}`)];
    return 줄.length === 0 ? `session ${sid} 산출물이 없다` : 줄.join('\n');
  }

  if (명령 === 'open' || 명령 === 'attach') {
    const 있음 = await readFile(파일).then(() => true, () => false);
    if (있음) throw new Error(`session ${이름} 이 이미 열려 있다 — close 부터 한다`);
  }

  // POST /session 없이 파일만 만든다. 화면을 먼저 찍어 살아 있는지 보고, 죽었으면 파일을 안 남긴다
  if (명령 === 'attach') {
    const sid = 인자[0];
    if (sid === undefined) throw new Error('attach 에 sessionId 가 필요하다');
    if (!/^[\w-]+$/.test(sid)) throw new Error(`session 번호는 글자 · 숫자 · _ · - 만 쓴다: ${sid}`);
    const s: 세션 = { sessionId: sid, snapshot: null, refs: {}, width: 0, height: 0, 붙음: true };
    let 찍음: string;
    try {
      // 케이스가 웹뷰에서 구간 안에 있으면 웹 맥락이다 — 네이티브 화면 글로 읽으면 HTML 이 온다
      await 맥락을맞춘다(c, s);
      찍음 = await 찍는다(c, s, false);
    } catch (e) {
      throw new Error(`session ${sid} 에 못 붙었다 — ${e instanceof Error ? e.message.replace(/ — session 이 끝났다.*$/, ' — 이미 끝난 session 이다') : String(e)}`);
    }
    await 적는다(파일, s);
    return `session ${이름} 붙음 (${sid})\n${찍음}`;
  }

  if (명령 === 'open') {
    const app = values.app ?? env.PLATFORM_APP;
    if (!app) throw new Error('앱을 띄우려면 --app 이나 PLATFORM_APP 이 필요하다');
    const 보낸 = { ...capabilities(app, values.udid ?? env.PLATFORM_DEVICE_UDID, values.filter), ...캡읽기(values.cap ?? []) };
    const 열림 = (await 부른다(c, 'POST', '/session', { capabilities: { alwaysMatch: 보낸 } })) as { sessionId?: string; capabilities?: Record<string, unknown> } | undefined;
    if (열림?.sessionId === undefined) throw new Error('Appium 이 session 번호를 주지 않았다');
    // UiAutomator2 는 apk 에서 읽은 appPackage · appActivity 를 session 답에 싣는다(접두 없이 — 있으면 appium: 도 본다). 답에 없으면 보낸 값
    const 캡 = { ...Object.fromEntries(Object.entries(보낸).map(([k, v]) => [k.replace(/^appium:/, ''), v])), ...열림.capabilities };
    const 앱 = Object.fromEntries(
      (['appPackage', 'appActivity', 'optionalIntentArguments'] as const).flatMap((k) => {
        const v = 캡[k] ?? 캡[`appium:${k}`];
        return typeof v === 'string' ? [[k, v]] : [];
      }),
    ) as 띄운앱;
    if (!패키지이름인가(app)) 앱.app = app;
    const s: 세션 = { sessionId: 열림.sessionId, snapshot: null, refs: {}, width: 0, height: 0, 앱 };
    await 적는다(파일, s);
    const 찍음 = await 찍는다(c, s, false);
    await 적는다(파일, s);
    return `session ${이름} 열림 (${s.sessionId})\n${찍음}`;
  }

  const s = await 읽는다(파일);
  const sid = s.sessionId;
  // Appium 은 logcat 을 session 마다 한 번만 준다 — 여기서 읽으면 케이스(kit · apis --session-id)가 그 줄을 못 받는다
  if (s.붙음 === true && (명령 === 'logs' || 명령 === 'crawl') && values.force !== true) {
    throw new Error(`붙은 session 에서 ${명령} 를 하면 logcat 새 줄을 가로채 케이스 쪽에서 사라진다${명령 === 'crawl' ? ' (앱도 다시 띄운다)' : ''} — 그래도 하려면 --force`);
  }
  if (s.붙음 === true && 명령 === 'notifications' && values.force !== true) throw new Error('붙은 session 에서 알림 창을 내리면 케이스가 쓰는 앱 위를 덮는다 — 그래도 하려면 --force');
  // app front 는 붙은 session 의 꾸러미를 몰라 아래에서 따로 거절한다
  if (s.붙음 === true && 명령 === 'app' && 인자[0] !== 'front' && values.force !== true) throw new Error('붙은 session 에서 app 을 하면 케이스가 쓰는 앱을 다시 띄운다(clear 는 데이터도 지운다) — 그래도 하려면 --force');
  if (s.붙음 === true && 명령 === 'reinstall' && values.force !== true) throw new Error('붙은 session 에서 reinstall 을 하면 케이스가 쓰는 앱을 지우고 다시 깐다 — 그래도 하려면 --force');
  if (s.붙음 === true && 명령 === 'phone' && 인자[0] !== undefined && 인자[0] !== 'time' && values.force !== true) throw new Error('붙은 session 의 폰 상태를 바꾸면 케이스가 바뀐 폰에서 돈다 — 그래도 하려면 --force');
  if (s.붙음 === true && 명령 === 'file' && 인자[0] !== 'ls' && values.force !== true) throw new Error('붙은 session 의 폰에 파일을 넣거나 지우면 케이스의 고르기 화면이 바뀐다 — 그래도 하려면 --force');
  if (s.붙음 === true && 명령 === 'settings' && 인자.length > 0 && values.force !== true) throw new Error('붙은 session 의 설정을 바꾸면 케이스가 바뀐 설정으로 돈다 — 그래도 하려면 --force');
  if (s.붙음 === true && 명령 !== 'close') await 맥락을맞춘다(c, s);
  if (s.맥락 !== undefined && 네이티브명령.has(명령)) throw new Error(`웹 맥락(${s.맥락})에서는 ${명령} 을 못 쓴다 — context NATIVE_APP 으로 돌아가서 쓴다`);

  switch (명령) {
    case 'contexts': {
      const { 목록, 지금 } = await 맥락들(c, sid);
      const 줄 = 목록.map((x) => `- ${x}${x === 지금 ? ' (지금)' : ''}`);
      if (!목록.some((x) => x !== 'NATIVE_APP')) 줄.push('웹뷰 맥락이 없다 — 웹 화면이 아직 안 떴거나 앱이 웹뷰 디버깅을 켠 빌드가 아니다(그러면 웹뷰 안도 네이티브 주소로만 찾는다)');
      return 줄.join('\n');
    }
    case 'context': {
      const 맥락 = 인자[0];
      if (맥락 === undefined || 맥락 === '') throw new Error('context 에 맥락 이름(NATIVE_APP · WEBVIEW_…)이 필요하다 — contexts 로 본다');
      if (s.붙음 === true && values.force !== true) throw new Error('붙은 session 의 맥락을 바꾸면 케이스가 바뀐 맥락에서 돈다 — 그래도 하려면 --force');
      const { 목록 } = await 맥락들(c, sid);
      if (!목록.includes(맥락)) throw new Error(`${맥락} 맥락이 없다 — 지금 있는 것: ${목록.join(' · ')}. 웹 화면이 막 뜨는 중이면 조금 뒤 contexts 로 다시 본다`);
      await 부른다(c, 'POST', `/session/${sid}/context`, { name: 맥락 });
      if (맥락 === 'NATIVE_APP') delete s.맥락;
      else s.맥락 = 맥락;
      const 찍음 = await 찍는다(c, s, false);
      await 적는다(파일, s);
      const 코드 = s.맥락 === undefined ? '// 케이스에서는 웹뷰에서 구간이 끝나면 kit 이 네이티브로 되돌린다' : '// 케이스에서는 구간으로 쓴다 — await 웹뷰에서(driver, async () => { … })';
      return `Ran: ${코드}\n${찍음}`;
    }
    case 'snapshot': {
      const 찍음 = await 찍는다(c, s, values.raw === true);
      await 적는다(파일, s);
      return 찍음;
    }
    case 'find': {
      const 찾을것 = 인자[0];
      if (찾을것 === undefined) throw new Error('find 에 찾을 글자가 필요하다');
      if (s.snapshot === null) throw new Error('찍은 화면이 없다 — snapshot 부터 한다');
      const 식 = values.regex === true ? 정규식(찾을것) : null;
      const 줄 = (await readFile(s.snapshot, 'utf8')).split('\n').filter((l) => (식 ? 식.test(l) : l.includes(찾을것)));
      return 줄.length === 0 ? '찾은 줄 없음' : 줄.map((l) => l.trim()).join('\n');
    }
    case 'logs': {
      // 읽은 줄은 Appium 이 다시 주지 않으니 식이 틀렸으면 읽기 전에 던진다
      const 거름 = values.grep === undefined ? null : 정규식(values.grep);
      const 꼴 = API꼴(values['api-pattern']);
      let 줄 = await logcat을읽는다(c, sid);
      if (s.logcat읽음 !== true) {
        s.logcat읽음 = true;
        await 적는다(파일, s);
        return `쌓인 줄 ${줄.length}개를 버렸다 — 다음 logs 부터 새 줄만 낸다`;
      }
      if (거름 !== null) 줄 = 줄.filter((l) => 거름.test(l));
      if (values.api === true || 꼴 !== undefined) 줄 = apiLines(줄, 꼴).map((a) => `${a.method} ${a.url}`);
      return 줄.length === 0 ? '새 줄 없음' : 줄.join('\n');
    }
    case 'crawl': {
      // 0 은 상한 없음 — 화면마다 누름 · 밀기 · 다시 로그인 상한만으로 끝난다(test_platform 앱 탐색은 앱 끝까지 훑는다)
      const 장 = Number(values.max ?? 50);
      if (!Number.isInteger(장) || 장 < 0) throw new Error('--max 는 0(상한 없음)이나 1 이상인 정수다');
      const 분 = Number(values.minutes ?? 10);
      if (!(분 >= 0)) throw new Error('--minutes 는 0(상한 없음)이나 0 보다 큰 수다');
      const 뺄 = (values.exclude ?? []).map(정규식);
      const 꼴 = API꼴(values['api-pattern']);
      const 출력 = values.out ?? join(폴더, 'crawl');
      // 저장본(에이전트가 화면 기록에서 만든 kept/index.json) — 없거나 틀린 파일은 없는 것으로 (test_platform 과 같다)
      const 저장 = values.keep === undefined ? null : await readFile(values.keep, 'utf8').then((t) => 저장본모양(JSON.parse(t))).catch(() => null);
      // 로그아웃 판을 다 돈 뒤에 죽지 않게 스크립트 · 역할을 먼저 본다
      const 역할 = values.role ?? '일반 회원'; // test_platform `기본역할`(@platform/kit/accounts)
      if (!상태인가(`로그인:${역할}`)) throw new Error(`--role 은 앞뒤 빈칸 없이 40자까지다: ${역할}`);
      const 줄들 = values.login === undefined ? null : 스크립트읽기(await readFile(values.login, 'utf8'));
      if (줄들 !== null) 띄우기('', s.앱); // 판 사이에 다시 띄울 intent 인자도
      const 연결인자 = [...(values.url === undefined ? [] : ['--url', values.url]), ...(values.token === undefined ? [] : ['--token', values.token])];
      const 로그인 = 줄들 === null ? undefined : {
        역할,
        ...(s.앱 === undefined ? {} : { 앱: s.앱 }),
        돌린다: async (): Promise<void> => {
          for (const 줄 of 줄들) await run([`-s=${이름}`, ...줄, ...연결인자], env);
        },
      };
      await 지난결과를지운다(출력);
      const 시작 = Date.now();
      const r = await crawl(c, sid, { 장: 장 || Infinity, 분: 분 || Infinity }, 뺄, 꼴, 로그인);
      const { 파일들, 저장본, 목록수 } = 결과파일들(r, 저장, new Date().toISOString().slice(0, 10));
      for (const [경로, 글] of 파일들) {
        await mkdir(dirname(join(출력, 경로)), { recursive: true });
        await writeFile(join(출력, 경로), 글);
      }
      const 목록 = join(출력, 'list.json');
      if (r.예외 !== undefined) throw new Error(`크롤이 도중에 멈췄다 — ${r.예외}. 본 것까지는 ${목록} 에 남겼다`);
      // 크롤이 화면을 옮겼으니 ref 표를 지금 화면으로 바꾼다
      const 찍음 = await 찍는다(c, s, false);
      await 적는다(파일, s);
      const 초 = ((Date.now() - 시작) / 1000).toFixed(1);
      const API수 = r.screens.reduce((n, x) => n + x.apis.length, 0);
      const 창수 = Object.values(r.dialogs).reduce((n, x) => n + x, 0);
      const 판셈 = [...new Set(r.screens.map((x) => x.상태))].map((상) => `${상} ${r.screens.filter((x) => x.상태 === 상).length}장`).join(' · ');
      const 로그인셈 = 로그인 === undefined ? '' : ` · 다시 로그인 ${r.다시로그인}번(앱 비우기 ${r.앱비우기 ?? '-'})`;
      return (
        `크롤: ${판셈} · 목록 ${목록수}장 · 연결 ${r.links.length}개 · API ${API수}개 · 누름 ${r.presses}번 · 재시작 ${r.restarts}번 · 지름길 ${r.지름길.닿음}번(못 닿음 ${r.지름길.못닿음}) · 확인 창 ${창수}번${로그인셈}` +
        ` · ${저장본} · 멈춘 까닭 ${r.stopped ?? '다 봄'} · ${초}초 · ${목록}\n${찍음}`
      );
    }
    case 'screen': {
      const { key, name } = (await 본다(c, sid)).정보;
      return name === '' ? key : `${key} · ${name}`;
    }
    case 'wait': {
      const 선택자 = 인자[0];
      const 글 = values.text;
      if (s.맥락 !== undefined) {
        if (글 !== undefined) throw new Error("웹 맥락의 wait 은 선택자로 기다린다 — 글자는 'button=글' · 'aria/글' 꼴로 준다");
        const x = 웹인자(선택자);
        if (웹ref인가(x)) throw new Error(`wait 은 ref 가 아니라 선택자를 받는다 — ${x} 의 선택자는 generate-locator ${x} 로 본다`);
        const 사라짐 = values.gone === true;
        const 제한 = 양의정수(values.timeout, 10_000, '--timeout');
        const 시작 = Date.now();
        for (;;) {
          const 보임 = await 웹보인다(c, sid, x);
          if (보임 !== undefined && 보임 !== 사라짐) break;
          if (Date.now() - 시작 >= 제한) throw new Error(`${x} — ${제한 / 1000}초 안에 ${사라짐 ? '사라지지 않았다' : '뜨지 않았다'}`);
          await new Promise((ok) => setTimeout(ok, 가라앉기.간격_ms));
        }
        const ms = Date.now() - 시작;
        const 찍음 = await 찍는다(c, s, false);
        await 적는다(파일, s);
        return `Ran: await driver.$(${따옴표(x)}).waitForDisplayed({ ${사라짐 ? 'reverse: true, ' : ''}timeout: ${제한} })\nWaited: ${ms}ms\n${찍음}`;
      }
      if ((선택자 === undefined) === (글 === undefined)) throw new Error("wait 에는 선택자('~desc' · 'id=…' · 'android=…') 나 --text <글자> 중 하나가 필요하다");
      if (선택자 !== undefined && !선택자인가(선택자)) throw new Error(`wait 은 ref 가 아니라 선택자('~desc' · 'id=…' · 'android=…')를 받는다: ${선택자}`);
      const 사라짐 = values.gone === true;
      const 제한 = 양의정수(values.timeout, 10_000, '--timeout');
      // UiSelector 는 화면 글로 못 맞춘다 — 폰에 물어 kit 뜰때까지 처럼 보이는지 본다
      const 맞음 = 선택자?.startsWith('android=') === true ? (): Promise<boolean> => 보인다(c, sid, 선택자) : 맞추기(선택자, 글);
      const ms = await 기다린다(c, sid, 선택자 ?? `--text ${JSON.stringify(글)}`, 맞음, 사라짐, 제한);
      const 찍음 = await 찍는다(c, s, false);
      await 적는다(파일, s);
      const 코드 = 선택자 === undefined ? '' : `Ran: await ${사라짐 ? '사라질때까지' : '뜰때까지'}(driver, ${따옴표(선택자)}${제한 === 10_000 ? '' : `, ${제한}`})\n`;
      return `${코드}Waited: ${ms}ms\n${찍음}`;
    }
    case 'toast': {
      const 본 = await 토스트를본다(c, sid, 양의정수(values.timeout, 5000, '--timeout'));
      if (본.length === 0) throw new Error('토스트를 못 봤다 — 누른 바로 뒤에 부른다');
      return 본.map(토스트줄).join('\n');
    }
    case 'wait-any': {
      // 같은 후보가 둘이면 Ran 줄의 객체 열쇠가 겹친다
      const 후보들 = [...new Set(인자)];
      if (후보들.length < 2 || !후보들.every(선택자인가)) throw new Error("wait-any 에는 서로 다른 선택자('~desc' · 'id=…' · 'android=…')가 둘 이상 필요하다");
      const 제한 = 양의정수(values.timeout, 30_000, '--timeout');
      const 뜬 = await 먼저뜬다(c, sid, 후보들, 제한);
      const 찍음 = await 찍는다(c, s, false);
      await 적는다(파일, s);
      // 열쇠는 선택자 그대로 낸다 — 케이스에서는 화면 이름으로 바꿔 쓴다
      const 후보 = 후보들.map((x) => `${따옴표(x)}: ${따옴표(x)}`).join(', ');
      return `Ran: await 먼저뜨는것(driver, { ${후보} }${제한 === 30_000 ? '' : `, ${제한}`})\nFound: ${뜬}\n${찍음}`;
    }
    case 'count': {
      const x = 인자[0];
      if (s.맥락 !== undefined) {
        const 선택자 = 웹인자(x);
        if (웹ref인가(선택자)) throw new Error(`count 은 선택자를 받는다 — ${선택자} 의 선택자는 generate-locator ${선택자} 로 본다`);
        const 찍음 = await 찍는다(c, s, false);
        await 적는다(파일, s);
        const { 수, 줄 } = await 웹세어본다(c, sid, 선택자);
        return [셈줄(수), ...줄, 찍음].join('\n');
      }
      if (!선택자인가(x)) throw new Error(`count 은 선택자('~desc' · 'id=…' · 'android=…')를 받는다: ${x ?? '(없음)'}`);
      // 맞은 자리를 지금 화면의 ref 와 견주려고 먼저 찍는다
      const 찍음 = await 찍는다(c, s, false);
      await 적는다(파일, s);
      const { 수, 줄 } = await 세어본다(c, sid, x, s.refs);
      return [셈줄(수), ...줄, 찍음].join('\n');
    }
    case 'visible': {
      const x = 인자[0];
      if (s.맥락 !== undefined) {
        const 선택자 = 웹인자(x);
        if (웹ref인가(선택자)) throw new Error('visible 은 선택자를 받는다');
        return `Ran: await driver.$(${따옴표(선택자)}).isDisplayed()\nVisible: ${(await 웹보인다(c, sid, 선택자)) === true ? '예' : '아니오'}`;
      }
      if (!선택자인가(x)) throw new Error(`visible 은 선택자('~desc' · 'id=…' · 'android=…')를 받는다: ${x ?? '(없음)'}`);
      return `Ran: await 보이나(driver, ${따옴표(x)})\nVisible: ${(await 보인다(c, sid, x)) ? '예' : '아니오'}`;
    }
    case 'info':
      return 조회한다(c, sid, s.앱?.appPackage);
    case 'clipboard': {
      // 화면을 안 바꿔 찍지 않는다. 팜은 폰을 돌려받을 때 클립보드를 비운다
      const [할일, 글] = 인자;
      const 실행 = (script: string, arg: Record<string, unknown>): Promise<unknown> => 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script, args: [arg] });
      if (할일 === undefined) {
        const 읽은 = Buffer.from(String((await 실행('mobile: getClipboard', {})) ?? ''), 'base64').toString('utf8');
        return `Ran: await 클립보드읽기(driver)\nClipboard: 「${읽은}」`;
      }
      if (할일 !== 'write' || 글 === undefined) throw new Error('clipboard 는 인자 없이(읽기) · write <글> 이다 — 붙여 넣기는 press paste');
      await 실행('mobile: setClipboard', { content: Buffer.from(글, 'utf8').toString('base64'), contentType: 'plaintext' });
      return `Ran: await 클립보드쓰기(driver, ${따옴표(글)})`;
    }
    case 'permission': {
      // 시험 대상 앱의 것만 — 앞에 온 다른 앱(current_package)의 권한을 바꾸지 않게 꾸러미를 지금 화면에서 읽지 않는다
      const 꾸러미 = s.앱?.appPackage;
      if (꾸러미 === undefined) throw new Error('시험 대상 앱 꾸러미를 모른다 — open 으로 연 session 에서만 쓴다(붙은 session 은 못 쓴다)');
      const [할일, ...이름들] = 인자;
      if (할일 === undefined) return 권한목록(c, sid, 꾸러미);
      if ((할일 !== 'grant' && 할일 !== 'revoke') || 이름들.length === 0) throw new Error('permission 은 인자 없이(보기) · grant <권한…> · revoke <권한…> 이다');
      const 줄까 = 할일 === 'grant';
      const 온이름 = [...new Set(이름들.map(권한이름))];
      // 다시 띄울 길을 먼저 정한다 — 못 옮기는 intent 인자면 권한을 빼 앱을 끄기 전에 던진다(app restart 와 같다)
      const 띄움 = 줄까 ? null : 띄우기(꾸러미, s.앱);
      const { 앞, 되돌리기, 실패 } = await 권한바꾼다(c, sid, 꾸러미, 줄까, 온이름);
      const 줄 = [`Ran: // 케이스에서는 구간으로 쓴다 — await 권한상태에서(driver, { ${줄까 ? '준다' : '뺀다'}: [${온이름.map(따옴표).join(', ')}] }, async () => { … })`, ...앞];
      if (되돌리기 !== null) 줄.push(`- 탐색이 끝나면 되돌린다: ${되돌리기}`);
      // 준 권한을 빼면 Android 가 앱 프로세스를 끈다 — app restart 와 같은 길로 다시 띄운다
      if (띄움 !== null && 되돌리기 !== null) {
        await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script: 띄움.script, args: [띄움.arg] });
        줄.push('- 권한을 빼서 꺼진 앱을 다시 띄웠다', await 찍는다(c, s, false));
        await 적는다(파일, s);
      }
      if (실패 !== undefined) throw new Error([실패, ...줄.slice(1)].join('\n'));
      return 줄.join('\n');
    }
    case 'phone': {
      const [할일, ...값] = 인자;
      if (할일 === undefined) return 폰상태(c, sid);
      if (할일 === 'time') return `Ran: await 폰시각(driver${값[0] === undefined ? '' : `, ${따옴표(값[0])}`})\nTime: ${await 폰시각(c, sid, 값[0])}`;
      let 결과: 바꿈;
      if (할일 === 'rotate') {
        if (!방향인가(값[0])) throw new Error('phone rotate 는 landscape · portrait 다');
        결과 = await 돌린다(c, sid, 값[0]);
      } else if (할일 === 'network' || 할일 === 'dark') {
        if (값[0] !== 'on' && 값[0] !== 'off') throw new Error(`phone ${할일} 은 on · off 다`);
        결과 = 할일 === 'network' ? await 네트워크(c, sid, 값[0] === 'on') : await 어두운화면(c, sid, 값[0] === 'on');
      } else if (할일 === 'location') {
        const [위도, 경도] = 값.map(Number);
        if (값[0] === 'reset') 결과 = await 위치(c, sid, 'reset');
        else if (값.length === 2 && Math.abs(위도!) <= 90 && Math.abs(경도!) <= 180) 결과 = await 위치(c, sid, { 위도: 위도!, 경도: 경도! });
        else throw new Error('phone location 은 <위도> <경도>(위도 -90~90 · 경도 -180~180) · reset 이다');
      } else if (할일 === 'font') {
        const 배율 = Number(값[0]);
        if (!(배율 > 0 && 배율 <= 3)) throw new Error('phone font 는 0 보다 크고 3 까지의 배율이다 — 1 이 기본');
        결과 = await 글자크기(c, sid, 배율);
      } else {
        throw new Error('phone 은 인자 없이(보기) · rotate · network · location · dark · font · time 이다');
      }
      const 줄 = [`Ran: ${결과.Ran}`, 결과.앞];
      if (결과.되돌리기 !== null) 줄.push(`- 탐색이 끝나면 되돌린다: ${결과.되돌리기}`);
      줄.push(await 찍는다(c, s, false));
      await 적는다(파일, s);
      return 줄.join('\n');
    }
    case 'file': {
      const [할일, 값, 이름] = 인자;
      if (할일 === 'push') {
        if (!파일종류인가(값)) throw new Error('file push 는 사진 · 영상 · 파일 이다');
        const 크기 = values.size === undefined ? undefined : Number(values.size);
        const 넣음 = await 넣는다(c, sid, 값, 크기);
        return [
          `Ran: const 파일 = await 폰에파일넣기(driver, ${따옴표(값)}${크기 === undefined ? '' : `, { 크기: ${크기} }`})`,
          '// 케이스는 finally 에서 await 파일.지우기() — 고르기 화면에서는 파일.이름 으로 고른다',
          `File: ${넣음.경로}`,
          `- 탐색이 끝나면 지운다: file rm ${넣음.경로}`,
        ].join('\n');
      }
      if (할일 === 'ls') {
        if (값 === undefined || !값.startsWith('/')) throw new Error('file ls 는 폰 안 폴더의 절대 경로다 — 예: file ls /sdcard/Download');
        const 이름들 = await 폴더를본다(c, sid, 값);
        if (이름 !== undefined) return `Ran: await 폰파일있나(driver, ${따옴표(값)}, ${따옴표(이름)})\nExists: ${이름들.includes(이름)}`;
        return 이름들.length === 0 ? `${값} 가 비었거나 없다` : 이름들.join('\n');
      }
      if (할일 === 'rm') {
        if (값 === undefined || !넣은파일인가(값)) throw new Error('file rm 은 file push 로 넣은 파일(/sdcard/Pictures · Movies · Download 의 qa- 이름)만 지운다');
        await 지운다(c, sid, 값);
        return `지웠다: ${값}`;
      }
      throw new Error('file 은 push · ls · rm 이다');
    }
    case 'settings': {
      if (인자.length === 0) {
        const v = ((await 부른다(c, 'GET', `/session/${sid}/appium/settings`)) ?? {}) as Record<string, unknown>;
        return Object.entries(v).map(([k, x]) => `${k}=${JSON.stringify(x)}`).join('\n');
      }
      const 바꿀 = 캡읽기(인자, 'settings');
      await 부른다(c, 'POST', `/session/${sid}/appium/settings`, { settings: 바꿀 });
      // 케이스는 설정을 직접 바꾸지 않는다 — 화면 멈춤 기다림만 kit 구간 부품이 있다(되돌리기까지 맡는다)
      const 코드 =
        Object.keys(바꿀).length === 1 && typeof 바꿀.waitForIdleTimeout === 'number'
          ? `// 케이스에서는 구간으로 쓴다 — await 움직이는화면에서(driver, async () => { … }, ${바꿀.waitForIdleTimeout})`
          : '// 케이스에 옮길 부품이 없다 — 탐색에서만 바꾼다';
      return [`Ran: ${코드}`, ...Object.entries(바꿀).map(([k, x]) => `Set: ${k}=${JSON.stringify(x)}`)].join('\n');
    }
    case 'generate-locator': {
      if (s.맥락 !== undefined) {
        const x = 웹인자(인자[0]);
        if (웹ref인가(x)) {
          const r = await 웹주소(c, sid, x);
          return r.loc === null ? (r.까닭 ?? '주소 없음') : `driver.$(${따옴표(r.loc)})`;
        }
        const 찍음 = await 찍는다(c, s, false);
        await 적는다(파일, s);
        const { 수, 줄 } = await 웹세어본다(c, sid, x);
        if (수 !== 1) throw new Error([`${x} — ${셈줄(수)}`, ...줄].join('\n'));
        return [`driver.$(${따옴표(x)})`, ...줄, 찍음].join('\n');
      }
      if (선택자인가(인자[0])) {
        const x = 인자[0];
        const 찍음 = await 찍는다(c, s, false);
        await 적는다(파일, s);
        const { 수, 줄 } = await 세어본다(c, sid, x, s.refs);
        if (수 !== 1) throw new Error([`${x} — ${셈줄(수)}`, ...줄].join('\n'));
        return [`driver.$(${따옴표(x)})`, ...줄, 찍음].join('\n');
      }
      const { loc, 겹침 } = 고른다(s, 인자[0]);
      return 선택자글(loc, 겹침) ?? `driver.$(${따옴표(loc!)})`;
    }
    case 'attrs': {
      // 이름 넷 · hint 를 앞에, 나머지는 알파벳 차례 — 줄바꿈은 \n 으로 적어 한 줄에 하나를 지킨다
      const { el } = 고른다(s, 인자[0]);
      // v0.2.0 까지의 session 파일은 속성을 안 남겼다
      if (el.속성 === undefined) throw new Error('이 화면은 속성 없이 찍혔다 — snapshot 을 다시 찍고 거기 ref 를 쓴다');
      const 앞 = ['class', 'resource-id', 'content-desc', 'text', 'hint'].filter((k) => k in el.속성);
      const 키들 = [...앞, ...Object.keys(el.속성).filter((k) => !앞.includes(k)).sort()];
      return 키들.map((k) => `${k}=${el.속성[k]!.replace(/\n/g, '\\n')}`).join('\n');
    }
    case 'record': {
      // 로컬 Appium 용 — 팜은 session 마다 영상을 남긴다(artifacts)
      if (인자[0] === 'start') {
        await 부른다(c, 'POST', `/session/${sid}/appium/start_recording_screen`, {});
        return '녹화 시작 — 끝나면 record stop [--out <파일.mp4>]';
      }
      if (인자[0] !== 'stop') throw new Error('record 는 start · stop 이다');
      const b64 = await 부른다(c, 'POST', `/session/${sid}/appium/stop_recording_screen`, {});
      if (typeof b64 !== 'string' || b64 === '') throw new Error('받은 영상이 비었다 — record start 를 먼저 했는지 본다');
      const 영상 = values.out ?? join(폴더, `record-${Date.now()}.mp4`);
      await writeFile(영상, Buffer.from(b64, 'base64'));
      return `- Video: ${영상}`;
    }
    case 'screenshot': {
      const x = 인자[0];
      let 경로 = `/session/${sid}/screenshot`;
      if (x !== undefined && s.맥락 !== undefined) {
        경로 = `/session/${sid}/element/${(await 웹대상(c, sid, x)).id}/screenshot`;
      } else if (x !== undefined) {
        const { loc, 막힘 } = 대상(s, x);
        if (막힘 !== null) throw new Error(`${x} 는 요소 사진을 못 찍는다 — ${막힘}. 인자 없이 화면 사진을 찍는다`);
        경로 = `/session/${sid}/element/${await 찾는다(c, sid, loc!)}/screenshot`;
      }
      const b64 = await 부른다(c, 'GET', 경로);
      const 그림 = values.filename ?? join(폴더, `screenshot-${Date.now()}.png`);
      await writeFile(그림, Buffer.from(String(b64), 'base64'));
      return `- Screenshot: ${그림}`;
    }
    case 'close': {
      // 남의 session 은 닫지 않는다. .last 도 안 적는다 — artifacts 기본값이 아직 도는 남의 session 을 가리키면 안 된다
      if (s.붙음 === true) {
        await rm(파일, { force: true });
        return `session ${이름} 떼어냄 — ${sid} 는 열어 둔다(남의 session)`;
      }
      // 이미 끊긴 session 이면 DELETE 가 실패한다. 그래도 파일은 지워야 다시 open 할 수 있다
      try {
        await 부른다(c, 'DELETE', `/session/${sid}`);
      } finally {
        await rm(파일, { force: true });
        await writeFile(마지막, sid);
      }
      return `session ${이름} 닫힘`;
    }
  }

  const 앞화면 = s.snapshot === null ? undefined : await readFile(s.snapshot, 'utf8').catch(() => undefined);
  let 코드: string;
  switch (명령) {
    case 'tap':
    case 'click': {
      if (s.맥락 !== undefined) {
        const { id, loc, 까닭 } = await 웹대상(c, sid, 인자[0]);
        await 부른다(c, 'POST', `/session/${sid}/element/${id}/click`, {});
        코드 = loc === null ? `// ${까닭 ?? '주소 없음'} (ref 로 눌렀다)` : `await driver.$(${따옴표(loc)}).click()`;
        break;
      }
      const { el, loc, 막힘 } = 대상(s, 인자[0]);
      if (막힘 === null) {
        const id = await 찾는다(c, sid, loc!);
        await 부른다(c, 'POST', `/session/${sid}/element/${id}/click`, {});
        // 권한 창 단추는 케이스에서 kit 부품으로 답한다 — 기종마다 뜨는 단추(「앱 사용 중에만 허용」 등)가 달라 부품이 고른다
        const 답 = 권한창답(loc!);
        코드 = 답 === undefined ? `await driver.$(${따옴표(loc!)}).click()` : [`await 권한창답하기(driver, '${답}')`, 권한창알림(loc!)].filter((x) => x !== null).join('\n');
      } else {
        // 선택자로는 엉뚱한 요소가 눌릴 수 있어 그 ref 의 가운데를 누른다
        const p = center(el!.bounds);
        if (p === null) throw new Error(`${인자[0]} 의 위치를 모른다`);
        await 좌표를누른다(c, sid, p.x, p.y);
        코드 = `// ${막힘} (좌표 ${p.x},${p.y} 를 눌렀다)`;
      }
      break;
    }
    case 'long-press':
    case 'double-tap': {
      const 길게 = 명령 === 'long-press';
      // 기본 시간은 kit `길게누르기` 와 같다. 한 요청이 60초에 끊겨 그보다 길게는 못 누른다
      const ms = 길게 ? 양의정수(values.ms, 길게기본_ms, '--ms') : 0;
      if (ms > 30_000) throw new Error(`--ms 은 30000 까지다: ${ms}`);
      const { el, loc, 막힘 } = 대상(s, 인자[0]);
      if (막힘 === null) {
        // tap 처럼 선택자를 실제로 찾아 케이스와 같은 동작을 한다 — Ran 줄을 옮기면 같은 일이 일어나야 한다
        const id = await 찾는다(c, sid, loc!);
        if (길게) {
          await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script: 'mobile: longClickGesture', args: [{ elementId: id, duration: ms }] });
          코드 = `await 길게누르기(driver, ${따옴표(loc!)}${ms === 길게기본_ms ? '' : `, ${ms}`})`;
        } else {
          const 누름 = (): Promise<unknown> => 부른다(c, 'POST', `/session/${sid}/element/${id}/click`, {});
          const 결과 = await Promise.allSettled([누름(), 누름()]);
          const 실패 = 결과.filter((x): x is PromiseRejectedResult => x.status === 'rejected');
          if (실패.length === 결과.length) throw 실패[0]!.reason;
          코드 = `await 두번누르기(await driver.$(${따옴표(loc!)}).getElement())`;
        }
      } else {
        const p = center(el!.bounds);
        if (p === null) throw new Error(`${인자[0]} 의 위치를 모른다`);
        await (길게 ? 길게누른다(c, sid, p.x, p.y, ms) : 두번누른다(c, sid, p.x, p.y));
        코드 = `// ${막힘} (좌표 ${p.x},${p.y} 를 ${길게 ? '길게' : '두 번'} 눌렀다)`;
      }
      break;
    }
    case 'swipe-in': {
      const 방향 = 인자[1];
      if (!밀방향인가(방향)) throw new Error('swipe-in 방향은 up · down · left · right 다 — swipe-in <ref|선택자> <방향>');
      const { el, loc, 막힘 } = 대상(s, 인자[0]);
      if (막힘 === null) {
        // kit 요소안에서밀기 와 같은 요청 — Ran 줄을 옮기면 같은 일이 일어나야 한다
        await 손짓(c, sid, 'mobile: swipeGesture', { elementId: await 찾는다(c, sid, loc!), direction: 방향, percent: 손동작정도 });
        코드 = `await 요소안에서밀기(driver, ${따옴표(loc!)}, '${방향말[방향]}')`;
      } else {
        const 곳 = 상자(el!.bounds);
        if (곳 === null) throw new Error(`${인자[0]} 의 위치를 모른다`);
        await 손짓(c, sid, 'mobile: swipeGesture', { ...곳, direction: 방향, percent: 손동작정도 });
        코드 = `// ${막힘} (요소 ${el!.bounds} 안에서 ${방향으로[방향]} 밀었다)`;
      }
      break;
    }
    case 'drag': {
      if (인자[1] === undefined) throw new Error('drag 에 어디서 · 어디로 둘이 필요하다 — drag <ref|선택자> <ref|선택자>');
      const 둘 = [대상(s, 인자[0]), 대상(s, 인자[1])] as const;
      // 둘 다 주소가 있으면 kit 끌어놓기 와 같은 요청 — 끝점은 놓을 요소의 가운데
      if (둘[0].막힘 === null && 둘[1].막힘 === null) {
        const 집을 = await 찾는다(c, sid, 둘[0].loc!);
        const 놓을 = (await 부른다(c, 'GET', `/session/${sid}/element/${await 찾는다(c, sid, 둘[1].loc!)}/rect`)) as { x: number; y: number; width: number; height: number };
        await 손짓(c, sid, 'mobile: dragGesture', { elementId: 집을, endX: Math.round(놓을.x + 놓을.width / 2), endY: Math.round(놓을.y + 놓을.height / 2) });
        코드 = `await 끌어놓기(driver, ${따옴표(둘[0].loc!)}, ${따옴표(둘[1].loc!)})`;
      } else {
        // 하나라도 주소가 없으면 화면 글의 자리로 끈다 — 케이스에는 못 옮긴다
        const 점 = 둘.map((x, i) => {
          const p = x.el === null ? null : center(x.el.bounds);
          if (p === null) throw new Error(x.el === null ? `${인자[i]} 는 선택자다 — 주소 없는 ref 와 함께 끌 때는 둘 다 ref 로 준다` : `${인자[i]} 의 위치를 모른다`);
          return p;
        });
        await 손짓(c, sid, 'mobile: dragGesture', { startX: 점[0]!.x, startY: 점[0]!.y, endX: 점[1]!.x, endY: 점[1]!.y });
        코드 = `// ${둘[0].막힘 ?? 둘[1].막힘} (좌표 ${점[0]!.x},${점[0]!.y} 에서 ${점[1]!.x},${점[1]!.y} 로 끌었다)`;
      }
      break;
    }
    case 'pinch-open':
    case 'pinch-close': {
      const 벌림 = 명령 === 'pinch-open';
      const script = 벌림 ? 'mobile: pinchOpenGesture' : 'mobile: pinchCloseGesture';
      const { el, loc, 막힘 } = 대상(s, 인자[0]);
      if (막힘 === null) {
        await 손짓(c, sid, script, { elementId: await 찾는다(c, sid, loc!), percent: 손동작정도 });
        코드 = `await ${벌림 ? '벌리기' : '오므리기'}(driver, ${따옴표(loc!)})`;
      } else {
        const 곳 = 상자(el!.bounds);
        if (곳 === null) throw new Error(`${인자[0]} 의 위치를 모른다`);
        await 손짓(c, sid, script, { ...곳, percent: 손동작정도 });
        코드 = `// ${막힘} (요소 ${el!.bounds} 에서 두 손가락을 ${벌림 ? '벌렸다' : '오므렸다'})`;
      }
      break;
    }
    case 'tap-xy': {
      if (!/^\d+$/.test(인자[0] ?? '') || !/^\d+$/.test(인자[1] ?? '')) throw new Error('tap-xy 는 0 이상의 정수 좌표 둘이다 — tap-xy <x> <y>');
      // 화면 밖인지는 폰이 가린다 — 마지막 화면 크기는 돌린 뒤라면 낡았다
      const [x, y] = [Number(인자[0]), Number(인자[1])];
      await 좌표를누른다(c, sid, x, y);
      코드 = `// 좌표 누르기는 케이스에 옮기지 않는다 — 요소가 없는 자리는 케이스에서 보류다 (좌표 ${x},${y} 를 눌렀다)`;
      break;
    }
    case 'draw': {
      // kit 요소위에그리기 와 같은 셈 — 점은 요소 안 %(0~100)라 폰 크기가 달라도 같은 자리를 긋는다
      const 점들 = 점들을읽는다(인자.slice(1));
      const { el, loc, 막힘 } = 대상(s, 인자[0]);
      if (막힘 === null) {
        const r = (await 부른다(c, 'GET', `/session/${sid}/element/${await 찾는다(c, sid, loc!)}/rect`)) as 요소상자;
        if (!(r?.width > 0 && r.height > 0)) throw new Error(`${loc} 의 크기가 없다`);
        await 긋는다(c, sid, 자리들(r, 점들));
        코드 = `await 요소위에그리기(driver, ${따옴표(loc!)}, ${점글(점들)})`;
      } else {
        const r = 테두리상자(el!.bounds);
        if (r === null) throw new Error(`${인자[0]} 의 위치를 모른다`);
        await 긋는다(c, sid, 자리들(r, 점들));
        코드 = `// ${막힘} (요소 ${el!.bounds} 안 ${점글(점들)} 을 그었다)`;
      }
      break;
    }
    case 'exec':
      // 화면을 안 바꿔 찍지 않는다 — 읽기 명령만 받는다
      return 읽기명령을부른다(c, sid, 읽기명령이름(인자[0]), 인자를읽는다(인자[1]));
    case 'fill':
    case 'clear': {
      // clear 는 넣지 않고 비우기만 한다 — kit 칸비우기(clearValue)와 같은 요청
      const 비움 = 명령 === 'clear';
      const 값 = 인자[1];
      if (!비움 && 값 === undefined) throw new Error('fill 에 넣을 값이 필요하다');
      if (비움 && values.submit === true) throw new Error('clear 는 --submit 을 받지 않는다');
      const 비우기코드 = (loc: string): string => `await 칸비우기(await driver.$(${따옴표(loc)}).getElement())`;
      if (s.맥락 !== undefined) {
        // 키보드 완료는 네이티브 명령이다 — 웹 케이스처럼 단추를 누른다
        if (values.submit === true) throw new Error('웹 맥락에서는 --submit 을 못 쓴다 — 보내기 단추를 tap 한다');
        const { id, loc, 까닭 } = await 웹대상(c, sid, 인자[0]);
        // WebdriverIO setValue 처럼 비우고 넣는다 — Ran 줄을 옮기면 같은 일이 일어나야 한다
        await 부른다(c, 'POST', `/session/${sid}/element/${id}/clear`, {});
        if (!비움) await 부른다(c, 'POST', `/session/${sid}/element/${id}/value`, { text: 값 });
        코드 = loc === null ? `// ${까닭 ?? '주소 없음'} (ref 칸${비움 ? '을 비웠다' : '에 넣었다'})` : 비움 ? 비우기코드(loc) : `await driver.$(${따옴표(loc)}).setValue(${따옴표(값!)})`;
        break;
      }
      const { el, loc, 막힘 } = 대상(s, 인자[0]);
      let id: string;
      if (막힘 === null) {
        id = await 찾는다(c, sid, loc!);
        코드 = 비움 ? 비우기코드(loc!) : `await driver.$(${따옴표(loc!)}).setValue(${따옴표(값!)})`;
      } else {
        const p = center(el!.bounds);
        if (p === null) throw new Error(`${인자[0]} 의 위치를 모른다`);
        await 좌표를누른다(c, sid, p.x, p.y);
        // 실측(F6-05 Compose): 첫 입력칸은 누르고 1초 뒤에도 element/active 가 no such element 였다 — 키보드가 뜨며 잡힌다
        id = await 될때까지(
          async () => Object.values((await 부른다(c, 'GET', `/session/${sid}/element/active`)) as Record<string, string>)[0]!,
          `좌표 ${p.x},${p.y} 를 누른 뒤 입력칸이 안 잡혔다`,
        );
        코드 = `// ${막힘} (좌표 ${p.x},${p.y} 칸${비움 ? '을 비웠다' : '에 넣었다'})`;
      }
      if (비움) {
        await 부른다(c, 'POST', `/session/${sid}/element/${id}/clear`, {});
        break;
      }
      await 부른다(c, 'POST', `/session/${sid}/element/${id}/value`, { text: 값 });
      // playwright-cli fill --submit(Enter) 자리 — Android 는 키보드의 완료 동작. Appium Settings IME 로 잠깐 바꿔 지금 포커스 칸에 보낸다
      // ponytail: done 만 보낸다 — 검색 · 이동(search · go)만 받는 칸이 나오면 --submit 에 동작 이름을 받는다
      if (values.submit === true) {
        await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script: 'mobile: performEditorAction', args: [{ action: 'done' }] });
        코드 += "\nRan: await driver.execute('mobile: performEditorAction', { action: 'done' })";
      }
      break;
    }
    case 'swipe': {
      const 방향 = 인자[0];
      if (!밀방향인가(방향)) throw new Error('swipe 방향은 up · down · left · right 다');
      await 손짓(c, sid, 'mobile: swipeGesture', { left: s.width * 0.1, top: s.height * 0.2, width: s.width * 0.8, height: s.height * 0.6, direction: 방향, percent: 손동작정도 });
      코드 = `await driver.swipe({ direction: ${따옴표(방향)} })`;
      break;
    }
    case 'press': {
      const 키 = 인자[0];
      if (!키인가(키)) throw new Error(`press 키는 ${Object.keys(폰키).join(' · ')} 다 — 키보드 완료는 fill --submit, 뒤로는 back`);
      // kit 키누르기 와 같은 요청 — Ran 줄을 옮기면 같은 일이 일어나야 한다
      await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script: 'mobile: pressKey', args: [{ keycode: 폰키[키].keycode }] });
      코드 = `await 키누르기(driver, '${폰키[키].이름}')`;
      break;
    }
    case 'type': {
      const 글 = 인자[0];
      if (글 === undefined || 글 === '') throw new Error('type 에 칠 글이 필요하다 — 칸을 먼저 tap 해서 포커스를 준다');
      // 포커스가 있는 칸에 키를 하나씩 친다 — 인증번호 여섯 칸처럼 칠 때마다 다음 칸으로 넘어가는 화면도 받는다
      const 됨 = await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script: 'mobile: type', args: [{ text: 글 }] });
      if (됨 === false) throw new Error('폰이 글을 받지 않았다 — 칸을 먼저 tap 해서 포커스를 준다(snapshot 의 포커스 줄)');
      코드 = `await 포커스칸에치기(driver, ${따옴표(글)})`;
      break;
    }
    case 'hide-keyboard': {
      // webdriverio hideKeyboard() 가 부르는 길 그대로 — Ran 줄과 같은 요청이다. 키보드가 없을 때 팜 답은 아직 못 봤다
      await 부른다(c, 'POST', `/session/${sid}/appium/device/hide_keyboard`, {});
      코드 = 'await driver.hideKeyboard()';
      break;
    }
    case 'app': {
      const 할일 = 인자[0];
      if (할일 !== 'restart' && 할일 !== 'clear' && 할일 !== 'front') throw new Error('app 은 restart · clear · front 다');
      if (할일 === 'front') {
        // 지금 앞에 있는 것은 다른 앱이라 current_package 로 고르지 않는다
        const 앱 = s.앱?.appPackage;
        if (앱 === undefined) throw new Error('시험 대상 앱 꾸러미를 모른다 — open 으로 연 session 에서만 쓴다');
        await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script: 'mobile: activateApp', args: [{ appId: 앱 }] });
        코드 = `await driver.activateApp(${따옴표(앱)})`;
        break;
      }
      const 꾸러미 = s.앱?.appPackage ?? String(await 부른다(c, 'GET', `/session/${sid}/appium/device/current_package`));
      // 띄울 길을 먼저 정한다 — intent 인자를 못 옮기면 앱을 끄거나 비우기 전에 던진다
      const 띄움 = 띄우기(꾸러미, s.앱);
      const 실행 = (script: string, arg: Record<string, unknown>): Promise<unknown> => 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script, args: [arg] });
      await 실행(할일 === 'restart' ? 'mobile: terminateApp' : 'mobile: clearApp', { appId: 꾸러미 });
      await 실행(띄움.script, 띄움.arg);
      // kit 부품과 같은 요청이다 — 앱다시켜기 · 인자로켜기 는 끈 뒤 띄우고, 앱비우기 는 비운 뒤(clearApp 이 앱도 끈다) 띄운다
      const 인자말 = 띄움.script === 'mobile: activateApp' ? undefined : 인자꼴(띄움.arg);
      if (인자말 === null) {
        // 글이 아닌 intent 인자(--ez · --ei …)는 kit 부품이 안 받는다 — 같은 요청을 직접 부르는 줄로 낸다
        코드 = [
          할일 === 'restart' ? `await driver.terminateApp(${따옴표(꾸러미)})` : `await driver.execute('mobile: clearApp', { appId: ${따옴표(꾸러미)} })`,
          `await driver.execute('mobile: startActivity', ${JSON.stringify(띄움.arg)})`,
        ].join('\nRan: ');
      } else if (할일 === 'restart') {
        코드 = 인자말 === undefined ? `await 앱다시켜기(driver, ${따옴표(꾸러미)})` : `await 인자로켜기(driver, ${인자말})`;
      } else {
        코드 = `await 앱비우기(driver${인자말 === undefined ? '' : `, ${인자말}`})`;
      }
      break;
    }
    case 'background': {
      const 초 = Number(인자[0]);
      if (!Number.isInteger(초) || 초 < 1 || 초 > 600) throw new Error('background 는 1~600 초다 — 그 초만큼 뒤에 있다 돌아온다');
      // kit 뒤로보냈다오기 와 같은 요청 — 돌아올 때까지 답을 안 준다
      await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script: 'mobile: backgroundApp', args: [{ seconds: 초 }] });
      코드 = `await 뒤로보냈다오기(driver, ${초})`;
      break;
    }
    case 'deeplink': {
      const 주소 = 인자[0];
      if (주소 === undefined || !/^[a-z][a-z0-9+.-]*:/i.test(주소)) throw new Error('deeplink 에 주소(myapp://… · https://…)가 필요하다');
      // 시험 대상 앱으로 연다 — 꾸러미를 안 주면 같은 주소를 받는 다른 앱 · 고르는 창이 뜬다
      const 꾸러미 = s.앱?.appPackage;
      if (꾸러미 === undefined) throw new Error('시험 대상 앱 꾸러미를 모른다 — open 으로 연 session 에서만 쓴다');
      await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script: 'mobile: deepLink', args: [{ url: 주소, package: 꾸러미 }] });
      코드 = `await 딥링크열기(driver, ${따옴표(주소)})`;
      break;
    }
    case 'screen-off-on': {
      const 실행 = (script: string): Promise<unknown> => 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script, args: [{}] });
      await 실행('mobile: lock');
      await 실행('mobile: unlock');
      코드 = 'await 화면껐다켜기(driver)';
      break;
    }
    case 'reinstall': {
      // 팜이 이번에 깐 시험 대상 앱만 — 패키지 이름으로 연 스토어 앱은 팜이 「남길 앱」으로 둔 것이라 지우면 다음 실행이 그 폰을 못 잡는다
      const 꾸러미 = s.앱?.appPackage;
      const 파일 = s.앱?.app;
      if (꾸러미 === undefined) throw new Error('시험 대상 앱 꾸러미를 모른다 — open 으로 연 session 에서만 쓴다');
      if (파일 === undefined) throw new Error('open 이 깐 앱 파일이 없다 — 패키지 이름으로 연 스토어 앱은 지우지 않는다(팜이 「남길 앱」으로 둔 앱이다). 앞 판에서 연 session 이면 다시 open 한다');
      const 실행 = (script: string, arg: Record<string, unknown>): Promise<unknown> => 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script, args: [arg] });
      // kit 앱다시깔기 와 같은 요청
      await 실행('mobile: removeApp', { appId: 꾸러미 });
      await 실행('mobile: installApp', { appPath: 파일 });
      await 실행('mobile: activateApp', { appId: 꾸러미 });
      코드 = 'await 앱다시깔기(driver)';
      break;
    }
    case 'scroll-to': {
      const 글자 = 인자[0];
      if (글자 === undefined || 글자 === '') throw new Error('scroll-to 에 찾을 글자가 필요하다');
      const { using, value } = w3c(굴려찾기선택자(글자));
      // kit 처럼 한 번만 묻는다 — 이 선택자는 물을 때마다 목록을 처음부터 굴린다
      try {
        await 요소를찾는다(c, sid, using, value);
      } catch (e) {
        throw new Error(`「${글자}」가 든 요소를 굴려도 찾지 못했다 — ${e instanceof Error ? e.message : String(e)}`);
      }
      코드 = `await 스크롤해서찾기(driver, ${따옴표(글자)})`;
      break;
    }
    case 'back': {
      await 부른다(c, 'POST', `/session/${sid}/back`, {});
      코드 = 'await driver.back()';
      break;
    }
    case 'notifications': {
      await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script: 'mobile: openNotifications', args: [{}] });
      코드 = 'await 알림창열기(driver)';
      break;
    }
    default:
      throw new Error(`모르는 명령: ${명령}\n\n${도움말}`);
  }

  // playwright-cli 처럼 액션마다 새 화면을 찍는다 — 화면이 바뀌면 이전 ref 는 쓸 수 없다
  const 찍음 = await 찍는다(c, s, false, 앞화면, ['tap', 'click', 'long-press', 'double-tap', 'tap-xy', 'swipe-in', 'drag', 'pinch-open', 'pinch-close', 'draw'].includes(명령));
  await 적는다(파일, s);
  return `Ran: ${코드}\n${찍음}`;
}
