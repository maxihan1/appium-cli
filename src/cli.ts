// 앱용 playwright-cli. 명령 하나를 Appium 요청으로 바꾸고, session 상태는 .appium-cli/<이름>.json 에 둔다

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { 연결주소, 부른다, 요소를찾는다, 좌표를누른다, type 연결 } from './appium.js';
import { capabilities, center, locatorFor, parseSource, w3c, type 요소 } from './platform/android.js';

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
}

export const 도움말 = `appium-cli [-s=<session>] <명령> [인자]

  open [--app <apk>] [--udid <id>]   앱을 띄우고 첫 화면을 찍는다
  snapshot [--raw]                   화면을 파일로 떨군다 (--raw 면 글을 그대로)
  find <글자> | --regex <식>           마지막 화면에서 줄을 찾는다
  tap <ref>                          누른다 (click 도 같다)
  fill <ref> <값>                     입력한다
  swipe up|down|left|right           손가락을 그 방향으로 민다
  back                               뒤로
  screenshot [--filename <파일>]       스크린샷
  generate-locator <ref>             webdriverio 선택자
  close                              session 을 닫는다
  list                               열린 session 목록

디바이스 팜 (session 을 열기 전에 폰을 잡는다)
  devices                            팜의 폰과 상태
  hold [--udid <serial>] [--minutes 30|60|120]   폰을 잡는다 (udid 가 없으면 빈 폰 하나)
  release [--udid <serial>]          폰을 놓는다 — 팜이 깐 앱 · 앱 데이터를 정리한다

연결: --url 또는 PLATFORM_APPIUM_URL (없으면 http://127.0.0.1:4723)
토큰: --token 또는 PLATFORM_APPIUM_TOKEN (팜이 인증을 켰을 때 — Bearer)
앱:   --app 또는 PLATFORM_APP · 폰: --udid 또는 PLATFORM_DEVICE_UDID`;

const 따옴표 = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

async function 읽는다(파일: string): Promise<세션> {
  try {
    return JSON.parse(await readFile(파일, 'utf8')) as 세션;
  } catch {
    throw new Error('열린 session 이 없다 — open 부터 한다');
  }
}

const 적는다 = (파일: string, s: 세션): Promise<void> => writeFile(파일, JSON.stringify(s, null, 2));

async function 찍는다(c: 연결, s: 세션, raw: boolean): Promise<string> {
  const xml = await 부른다(c, 'GET', `/session/${s.sessionId}/source`);
  if (typeof xml !== 'string') throw new Error('Appium 이 화면 글을 주지 않았다');
  const 화면 = parseSource(xml);
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
    },
  });
  const [명령, ...인자] = positionals;
  if (명령 === undefined || 명령 === 'help') return 도움말;

  // -s=probe 도 받는다 (playwright-cli 와 같은 꼴)
  const 이름 = (values.session ?? 'default').replace(/^=/, '');
  if (!/^[\w-]+$/.test(이름)) throw new Error(`session 이름은 글자 · 숫자 · _ · - 만 쓴다: ${이름}`);
  await mkdir(폴더, { recursive: true });
  const 파일 = join(폴더, `${이름}.json`);

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

  if (명령 === 'open') {
    const 있음 = await readFile(파일).then(() => true, () => false);
    if (있음) throw new Error(`session ${이름} 이 이미 열려 있다 — close 부터 한다`);
    const app = values.app ?? env.PLATFORM_APP;
    if (!app) throw new Error('앱을 띄우려면 --app 이나 PLATFORM_APP 이 필요하다');
    const 열림 = (await 부른다(c, 'POST', '/session', {
      capabilities: { alwaysMatch: capabilities(app, values.udid ?? env.PLATFORM_DEVICE_UDID) },
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
      const 식 = values.regex === true ? new RegExp(찾을것) : null;
      const 줄 = (await readFile(s.snapshot, 'utf8')).split('\n').filter((l) => (식 ? 식.test(l) : l.includes(찾을것)));
      return 줄.length === 0 ? '찾은 줄 없음' : 줄.map((l) => l.trim()).join('\n');
    }
    case 'generate-locator': {
      const { loc, 겹침 } = 고른다(s, 인자[0]);
      return 선택자글(loc, 겹침) ?? `driver.$(${따옴표(loc!)})`;
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
      }
      return `session ${이름} 닫힘`;
    }
  }

  let 코드: string;
  switch (명령) {
    case 'tap':
    case 'click': {
      const { el, loc, 겹침 } = 고른다(s, 인자[0]);
      const 막힘 = 선택자글(loc, 겹침);
      if (막힘 === null) {
        const id = await 요소를찾는다(c, sid, w3c(loc!).using, w3c(loc!).value);
        await 부른다(c, 'POST', `/session/${sid}/element/${id}/click`, {});
        코드 = `await driver.$(${따옴표(loc!)}).click()`;
      } else {
        // 선택자로는 엉뚱한 요소가 눌릴 수 있어 그 ref 의 가운데를 누른다
        const p = center(el.bounds);
        if (p === null) throw new Error(`${인자[0]} 의 위치를 모른다`);
        await 좌표를누른다(c, sid, p.x, p.y);
        코드 = `// ${막힘} (좌표 ${p.x},${p.y} 를 눌렀다)`;
      }
      break;
    }
    case 'fill': {
      const 값 = 인자[1];
      if (값 === undefined) throw new Error('fill 에 넣을 값이 필요하다');
      const { el, loc, 겹침 } = 고른다(s, 인자[0]);
      const 막힘 = 선택자글(loc, 겹침);
      let id: string;
      if (막힘 === null) {
        id = await 요소를찾는다(c, sid, w3c(loc!).using, w3c(loc!).value);
        코드 = `await driver.$(${따옴표(loc!)}).setValue(${따옴표(값)})`;
      } else {
        const p = center(el.bounds);
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
  const 찍음 = await 찍는다(c, s, false);
  await 적는다(파일, s);
  return `Ran: ${코드}\n${찍음}`;
}
