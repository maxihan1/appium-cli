// 앱용 playwright-cli. 명령 하나를 Appium 요청으로 바꾸고, session 상태는 .appium-cli/<이름>.json 에 둔다

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { logcat을읽는다, 가라앉기, 산출물을받는다, 연결주소, 부른다, 요소를찾는다, 좌표를누른다, 화면을기다린다, type 연결 } from './appium.js';
import { crawl, 본다 } from './crawl.js';
import { 결과파일들, 상태인가, 저장본모양 } from './crawl-out.js';
import { apiLines } from './logcat.js';
import { capabilities, center, locatorFor, w3c, type 요소 } from './platform/android.js';

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
}

export const 도움말 = `appium-cli [-s=<session>] <명령> [인자]

  open [--app <apk|URL>] [--udid <id>] [--filter <조건>] [--cap <키=값>]   앱을 띄우고 첫 화면을 찍는다
                                     --cap 은 capabilities 에 더한다 (여러 번 · 값이 JSON 이면 JSON · 기본값을 덮는다)
  snapshot [--raw]                   화면을 파일로 떨군다 (--raw 면 글을 그대로)
  find <글자> | --regex <식>           마지막 화면에서 줄을 찾는다
  tap <ref|선택자>                     누른다 (click 도 같다). 선택자 '~desc' · 'id=…' 는 지금 화면에서 찾는다
  fill <ref|선택자> <값>                입력한다
  swipe up|down|left|right           손가락을 그 방향으로 민다
  back                               뒤로
  screenshot [--filename <파일>]       스크린샷
  generate-locator <ref>             webdriverio 선택자
  attrs <ref>                        그 요소의 원래 XML 속성 (한 줄에 키=값 · 비밀번호 칸 text 는 안 낸다)
  screen                             지금 화면 키 · 이름 (crawl 과 같은 키 — 앱 화면 파일의 화면 주소 값)
  close                              session 을 닫는다 (번호를 남겨 artifacts 가 쓴다)
  list                               열린 session 목록
  logs [--grep <식>] [--api]          logcat 새 줄 (첫 호출은 쌓인 줄을 버린다) · --api 면 API 줄만 METHOD URL
  apis --session-id <id> | --file <logcat.txt>   남이 연 session · 팜 logcat 파일에서 API 를 [{method,url,at}] JSON 으로
  artifacts [sessionId] [--out <폴더>]   팜이 session 마다 남긴 영상 · logcat.txt 를 받는다
                                     (sessionId 가 없으면 이 이름으로 마지막에 close 한 session · 기본 .appium-cli/artifacts/<id>/)
  crawl [--max 50] [--minutes 10] [--exclude <식>] [--out <폴더>] [--keep <저장본>] [--login <스크립트> [--role <역할>]]
                                     지금 화면부터 눌러 가며 화면 파일 · list · index · links · apis · summary.json 을
                                     --out(기본 .appium-cli/crawl)에 (--max 는 100 장까지). --keep 이면 저장본과 같음 · 바뀜 · 새 화면
                                     위험 글자(삭제 · 결제 …) · --exclude 에 맞는 이름은 안 누른다 (--exclude 는 여러 번)
                                     --login 이면 로그아웃 판 뒤 앱 데이터를 지우고 스크립트로 로그인해 로그인:<역할>(기본 일반 회원) 판을 돈다
                                     로그아웃은 로그인 판에서 다시 로그인할 수 있을 때만 누른다 (다시 로그인은 세 번까지)
                                     스크립트는 한 줄에 tap · fill · back · swipe 하나 (선택자는 따옴표로: fill '~Username input field' bob)

디바이스 팜 (session 을 열기 전에 폰을 잡는다)
  devices                            팜의 폰과 상태
  hold [--udid <serial>] [--minutes 30|60|120]   폰을 잡는다 (udid 가 없으면 빈 폰 하나)
  release [--udid <serial>]          폰을 놓는다 — 팜이 깐 앱 · 앱 데이터를 정리한다

연결: --url 또는 PLATFORM_APPIUM_URL (없으면 http://127.0.0.1:4723)
토큰: --token 또는 PLATFORM_APPIUM_TOKEN (팜이 인증을 켰을 때 — Bearer)
앱:   --app 또는 PLATFORM_APP (팜은 URL — 받는 쪽이 팜 PC) · 폰: --udid 또는 PLATFORM_DEVICE_UDID
팜 폰 고르기: --filter 'os>=13,model=SM-*' (쉼표는 AND)
API 꼴: --api-pattern <식> (모임 둘: method · url — 기본은 OkHttp '--> GET https://…'). 물음표 · # 뒤는 지운다`;

const 따옴표 = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

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
const 스크립트명령 = new Set(['tap', 'click', 'fill', 'back', 'swipe']);

// ref 대신 선택자(`~desc` · `id=…`)도 받는다 — 로그인 스크립트처럼 ref 번호를 모르고 쓸 때
const 선택자인가 = (x: string | undefined): x is string => x !== undefined && /^(?:~|id=)./.test(x);

/** 로그인 스크립트 — 한 줄이 `appium-cli -s=<이름>` 뒤에 쓰는 명령 하나. 따옴표로 띄어쓰기를 묶고, 빈 줄 · `#` 줄은 건너뛴다. tap · fill 은 선택자만 (ref 는 화면마다 바뀐다) */
function 스크립트읽기(글: string): string[][] {
  const 줄들 = 글.split(/\r?\n/).flatMap((줄, i) => {
    const 낱 = [...줄.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]!);
    if (낱.length === 0 || 낱[0]!.startsWith('#')) return [];
    if (!스크립트명령.has(낱[0]!)) throw new Error(`로그인 스크립트 ${i + 1}줄: ${낱[0]} 은 못 쓴다 — tap · fill · back · swipe 만`);
    if (['tap', 'click', 'fill'].includes(낱[0]!) && !선택자인가(낱[1])) throw new Error(`로그인 스크립트 ${i + 1}줄: ref 대신 선택자('~desc' · 'id=…')를 쓴다`);
    return [낱];
  });
  if (줄들.length === 0) throw new Error('로그인 스크립트가 비었다');
  return 줄들;
}

// --cap 키=값 — 첫 = 에서 가른다(값에 = 가 들어간다). 값이 JSON(true · 5 · ["a"] · "따옴표")이면 그 값, 아니면 글 그대로
function 캡읽기(쌍들: string[]): Record<string, unknown> {
  return Object.fromEntries(
    쌍들.map((쌍) => {
      const i = 쌍.indexOf('=');
      if (i < 1) throw new Error(`--cap 은 키=값 꼴이다(키가 비면 안 된다): ${쌍}`);
      const 값 = 쌍.slice(i + 1);
      try {
        return [쌍.slice(0, i), JSON.parse(값) as unknown];
      } catch {
        return [쌍.slice(0, i), 값];
      }
    }),
  );
}

async function 읽는다(파일: string): Promise<세션> {
  try {
    return JSON.parse(await readFile(파일, 'utf8')) as 세션;
  } catch {
    throw new Error('열린 session 이 없다 — open 부터 한다');
  }
}

const 적는다 = (파일: string, s: 세션): Promise<void> => writeFile(파일, JSON.stringify(s, null, 2));

async function 찍는다(c: 연결, s: 세션, raw: boolean, 앞?: string): Promise<string> {
  const 화면 = await 화면을기다린다(c, s.sessionId, 앞);
  const 파일 = join(폴더, `screen-${Date.now()}.txt`);
  await writeFile(파일, 화면.글);
  Object.assign(s, { snapshot: 파일, refs: 화면.refs, width: 화면.width, height: 화면.height });
  return raw ? 화면.글 : `- Snapshot: ${파일}`;
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

// 선택자로 찾는다 — 앱이 막 떴으면(로그인 스크립트 첫 줄) 뜰 때까지 다시 찾는다
async function 찾는다(c: 연결, sid: string, loc: string): Promise<string> {
  const 끝 = Date.now() + 가라앉기.찾기_ms;
  for (;;) {
    try {
      return await 요소를찾는다(c, sid, w3c(loc).using, w3c(loc).value);
    } catch (e) {
      if (Date.now() >= 끝) throw new Error(`${loc} 를 지금 화면에서 못 찾았다 — ${e instanceof Error ? e.message : String(e)}`);
      await new Promise((ok) => setTimeout(ok, 가라앉기.간격_ms));
    }
  }
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
      const v = (await 부른다(팜, 'GET', '/api/devices?status=idle')) as { devices?: 폰[] } | null;
      serial = v?.devices?.[0]?.serial;
      if (!serial) throw new Error('잡을 수 있는 빈 폰이 없다 — devices 로 상태를 본다');
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

  if (명령 === 'open') {
    const 있음 = await readFile(파일).then(() => true, () => false);
    if (있음) throw new Error(`session ${이름} 이 이미 열려 있다 — close 부터 한다`);
    const app = values.app ?? env.PLATFORM_APP;
    if (!app) throw new Error('앱을 띄우려면 --app 이나 PLATFORM_APP 이 필요하다');
    const 더 = 캡읽기(values.cap ?? []);
    const 열림 = (await 부른다(c, 'POST', '/session', {
      capabilities: { alwaysMatch: { ...capabilities(app, values.udid ?? env.PLATFORM_DEVICE_UDID, values.filter), ...더 } },
    })) as { sessionId?: string } | undefined;
    if (열림?.sessionId === undefined) throw new Error('Appium 이 session 번호를 주지 않았다');
    const s: 세션 = { sessionId: 열림.sessionId, snapshot: null, refs: {}, width: 0, height: 0 };
    await 적는다(파일, s);
    const 찍음 = await 찍는다(c, s, false);
    await 적는다(파일, s);
    return `session ${이름} 열림 (${s.sessionId})\n${찍음}`;
  }

  const s = await 읽는다(파일);
  const sid = s.sessionId;

  switch (명령) {
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
      const 장 = Number(values.max ?? 50);
      if (!Number.isInteger(장) || 장 < 1 || 장 > 100) throw new Error('--max 는 1 ~ 100 장이다');
      const 분 = Number(values.minutes ?? 10);
      if (!(분 > 0)) throw new Error('--minutes 는 0 보다 큰 수다');
      const 뺄 = (values.exclude ?? []).map(정규식);
      const 꼴 = API꼴(values['api-pattern']);
      const 출력 = values.out ?? join(폴더, 'crawl');
      // 저장본(에이전트가 화면 기록에서 만든 kept/index.json) — 없거나 틀린 파일은 없는 것으로 (test_platform 과 같다)
      const 저장 = values.keep === undefined ? null : await readFile(values.keep, 'utf8').then((t) => 저장본모양(JSON.parse(t))).catch(() => null);
      // 로그아웃 판을 다 돈 뒤에 죽지 않게 스크립트 · 역할을 먼저 본다
      const 역할 = values.role ?? '일반 회원'; // test_platform `기본역할`(@platform/kit/accounts)
      if (!상태인가(`로그인:${역할}`)) throw new Error(`--role 은 앞뒤 빈칸 없이 40자까지다: ${역할}`);
      const 줄들 = values.login === undefined ? null : 스크립트읽기(await readFile(values.login, 'utf8'));
      const 연결인자 = [...(values.url === undefined ? [] : ['--url', values.url]), ...(values.token === undefined ? [] : ['--token', values.token])];
      const 로그인 = 줄들 === null ? undefined : {
        역할,
        돌린다: async (): Promise<void> => {
          for (const 줄 of 줄들) await run([`-s=${이름}`, ...줄, ...연결인자], env);
        },
      };
      const 시작 = Date.now();
      const r = await crawl(c, sid, { 장, 분 }, 뺄, 꼴, 로그인);
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
        `크롤: ${판셈} · 목록 ${목록수}장 · 연결 ${r.links.length}개 · API ${API수}개 · 누름 ${r.presses}번 · 재시작 ${r.restarts}번 · 확인 창 ${창수}번${로그인셈}` +
        ` · ${저장본} · 멈춘 까닭 ${r.stopped ?? '다 봄'} · ${초}초 · ${목록}\n${찍음}`
      );
    }
    case 'screen': {
      const { key, name } = (await 본다(c, sid)).정보;
      return name === '' ? key : `${key} · ${name}`;
    }
    case 'generate-locator': {
      const { loc, 겹침 } = 고른다(s, 인자[0]);
      return 선택자글(loc, 겹침) ?? `driver.$(${따옴표(loc!)})`;
    }
    case 'attrs': {
      // 이름 넷 · hint 를 앞에, 나머지는 알파벳 차례 — 줄바꿈은 \n 으로 적어 한 줄에 하나를 지킨다
      const { el } = 고른다(s, 인자[0]);
      const 앞 = ['class', 'resource-id', 'content-desc', 'text', 'hint'].filter((k) => k in el.속성);
      const 키들 = [...앞, ...Object.keys(el.속성).filter((k) => !앞.includes(k)).sort()];
      return 키들.map((k) => `${k}=${el.속성[k]!.replace(/\n/g, '\\n')}`).join('\n');
    }
    case 'screenshot': {
      const b64 = await 부른다(c, 'GET', `/session/${sid}/screenshot`);
      const 그림 = values.filename ?? join(폴더, `screenshot-${Date.now()}.png`);
      await writeFile(그림, Buffer.from(String(b64), 'base64'));
      return `- Screenshot: ${그림}`;
    }
    case 'close': {
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
      const { el, loc, 막힘 } = 대상(s, 인자[0]);
      if (막힘 === null) {
        const id = await 찾는다(c, sid, loc!);
        await 부른다(c, 'POST', `/session/${sid}/element/${id}/click`, {});
        코드 = `await driver.$(${따옴표(loc!)}).click()`;
      } else {
        // 선택자로는 엉뚱한 요소가 눌릴 수 있어 그 ref 의 가운데를 누른다
        const p = center(el!.bounds);
        if (p === null) throw new Error(`${인자[0]} 의 위치를 모른다`);
        await 좌표를누른다(c, sid, p.x, p.y);
        코드 = `// ${막힘} (좌표 ${p.x},${p.y} 를 눌렀다)`;
      }
      break;
    }
    case 'fill': {
      const 값 = 인자[1];
      if (값 === undefined) throw new Error('fill 에 넣을 값이 필요하다');
      const { el, loc, 막힘 } = 대상(s, 인자[0]);
      let id: string;
      if (막힘 === null) {
        id = await 찾는다(c, sid, loc!);
        코드 = `await driver.$(${따옴표(loc!)}).setValue(${따옴표(값)})`;
      } else {
        const p = center(el!.bounds);
        if (p === null) throw new Error(`${인자[0]} 의 위치를 모른다`);
        await 좌표를누른다(c, sid, p.x, p.y);
        const v = (await 부른다(c, 'GET', `/session/${sid}/element/active`)) as Record<string, string>;
        id = Object.values(v)[0]!;
        코드 = `// ${막힘} (좌표 ${p.x},${p.y} 칸에 넣었다)`;
      }
      await 부른다(c, 'POST', `/session/${sid}/element/${id}/value`, { text: 값 });
      break;
    }
    case 'swipe': {
      const 방향 = 인자[0];
      if (!['up', 'down', 'left', 'right'].includes(방향 ?? '')) throw new Error('swipe 방향은 up · down · left · right 다');
      await 부른다(c, 'POST', `/session/${sid}/execute/sync`, {
        script: 'mobile: swipeGesture',
        args: [{ left: s.width * 0.1, top: s.height * 0.2, width: s.width * 0.8, height: s.height * 0.6, direction: 방향, percent: 0.75 }],
      });
      코드 = `await driver.swipe({ direction: ${따옴표(방향!)} })`;
      break;
    }
    case 'back': {
      await 부른다(c, 'POST', `/session/${sid}/back`, {});
      코드 = 'await driver.back()';
      break;
    }
    default:
      throw new Error(`모르는 명령: ${명령}\n\n${도움말}`);
  }

  // playwright-cli 처럼 액션마다 새 화면을 찍는다 — 화면이 바뀌면 이전 ref 는 쓸 수 없다
  const 찍음 = await 찍는다(c, s, false, 앞화면);
  await 적는다(파일, s);
  return `Ran: ${코드}\n${찍음}`;
}
