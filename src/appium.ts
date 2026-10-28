// Appium 서버에 W3C WebDriver 요청을 보내는 얇은 클라이언트. URL 안 계정은 Basic 헤더로 옮긴다

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseSource, type 화면 } from './platform/android.js';

export interface 연결 {
  base: string;
  headers: Record<string, string>;
}

// URL 안 계정 → Basic 은 test_platform runner `appium주소`(apps/runner/src/appSession.ts)와 같은 규칙이다.
// 디바이스 팜은 계정 대신 개인 토큰을 Bearer 로 받는다 — 둘 다 오면 토큰이 앞선다
export function 연결주소(raw: string, token?: string): 연결 {
  const url = new URL(raw);
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (url.username !== '') {
    const 계정 = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
    headers.Authorization = `Basic ${Buffer.from(계정).toString('base64')}`;
  }
  url.username = '';
  url.password = '';
  return { base: url.toString().replace(/\/+$/, ''), headers };
}

// 첫 연결은 앱 설치까지 해서 오래 걸린다(test_platform 실측 9.4초). 나머지 명령도 UiAutomator2 의 idle 대기를 넉넉히 덮는다
const 제한_ms = 60_000;

export async function 부른다(c: 연결, method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${c.base}${path}`, {
    method,
    headers: { ...c.headers, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(제한_ms),
  });
  const json: unknown = await res.json().catch(() => null);
  // W3C 는 { value } 로 싸서 주고, 팜의 잡기 주소는 { held } · { refused } 를 그대로 준다
  const 몸 = json !== null && typeof json === 'object' && 'value' in json ? json.value : json;
  if (!res.ok) {
    const v = (몸 ?? {}) as { error?: string; message?: string; refused?: string };
    const 까닭 = v.message ?? v.refused ?? '';
    const 힌트 = v.error === 'invalid session id' ? ' — session 이 끝났다. open 부터 다시 한다' : '';
    throw new Error(`Appium 이 HTTP ${res.status} 로 답했다${까닭 === '' ? '' : `: ${까닭}`}${힌트}`);
  }
  return 몸;
}

const ELEMENT = 'element-6066-11e4-a5ab-c8d2b5b44a87';

export async function 요소를찾는다(c: 연결, sid: string, using: string, value: string): Promise<string> {
  try {
    const v = (await 부른다(c, 'POST', `/session/${sid}/element`, { using, value })) as Record<string, string>;
    return v[ELEMENT] ?? v.ELEMENT!;
  } catch (e) {
    // Compose testTag id(`login_id`)는 UiAutomator2 가 꾸러미를 붙여(`<pkg>:id/login_id`) 찾아서 못 찾는다 — 실측 데모마켓(F6-05)
    if (using === 'id' && !value.includes(':') && e instanceof Error) e.message += ' — 꾸러미 없는 id(Compose testTag)는 open 에 --cap appium:disableIdLocatorAutocompletion=true 가 있어야 찾힌다';
    throw e;
  }
}

// Appium 은 session 마다 읽은 자리를 기억해 다음 호출엔 새 줄만 준다(실측: 첫 호출 10,000줄 — 버퍼 상한)
export async function logcat을읽는다(c: 연결, sid: string): Promise<string[]> {
  const v = (await 부른다(c, 'POST', `/session/${encodeURIComponent(sid)}/se/log`, { type: 'logcat' })) as { message: string }[] | null;
  return (v ?? []).map((e) => e.message);
}

// 테스트가 줄일 수 있게 묶어 둔다. 찾기_ms 는 선택자로 찾을 때 — 앱 데이터를 지운 뒤 처음 뜨는 데 몇 초 걸린다
// 산출물_ms 는 팜이 session 산출물(영상 · logcat)을 다 만들 때까지(ready:false) 기다리는 시간
export const 가라앉기 = { 최대_ms: 3000, 간격_ms: 300, 찾기_ms: 10_000, 산출물_ms: 15_000, 산출물간격_ms: 1000 };

async function 읽어온다(c: 연결, sid: string): Promise<화면> {
  const xml = await 부른다(c, 'GET', `/session/${sid}/source`);
  if (typeof xml !== 'string') throw new Error('Appium 이 화면 글을 주지 않았다');
  return parseSource(xml);
}

/**
 * 앞 화면 글(앞)을 주면 액션 뒤 화면이 바뀌고 가라앉을 때까지 다시 읽는다.
 * React Native 앱은 누른 뒤 화면을 늦게 바꾼다 — 실측: 로그인 버튼 0.5초 뒤 snapshot 이 앞 화면이었다(2026-10-20 MDA).
 * 안 바뀌는 액션(같은 화면 안 누르기 · 비밀번호 입력)은 최대_ms 를 다 기다리고 마지막 화면을 쓴다
 */
export async function 화면을기다린다(c: 연결, sid: string, 앞?: string): Promise<화면> {
  let 화면 = await 읽어온다(c, sid);
  if (앞 === undefined) return 화면;
  let 바뀜 = 화면.글 !== 앞;
  const 끝 = Date.now() + 가라앉기.최대_ms;
  while (Date.now() < 끝) {
    await new Promise((r) => setTimeout(r, 가라앉기.간격_ms));
    const 다음 = await 읽어온다(c, sid);
    const 같음 = 다음.글 === 화면.글;
    화면 = 다음;
    if (바뀜 && 같음) break;
    if (다음.글 !== 앞) 바뀜 = true;
  }
  return 화면;
}

export function 좌표를누른다(c: 연결, sid: string, x: number, y: number): Promise<unknown> {
  return 부른다(c, 'POST', `/session/${sid}/actions`, {
    actions: [
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x, y },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 100 },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ],
  });
}

export interface 산출물 {
  name: string;
  bytes: number;
  path: string;
}

interface 산출물목록 {
  ready?: boolean;
  files?: { name: string; bytes?: number; url: string }[];
  errors?: unknown[];
}

// ponytail: 내려받기 10분 상한 — 더 긴 영상이 끊기면 늘린다
const 내려받기_ms = 600_000;

/**
 * 팜 session 산출물(`GET /api/sessions/{id}/artifacts` — logcat.txt · video-N.mp4 …, 30일 보관)을 폴더에 받는다.
 * 팜이 아직 만드는 중(ready:false)이면 산출물_ms 까지 다시 본다. files[].url 은 팜 원점 기준 경로(`/wd/hub/api/…`)다
 */
export async function 산출물을받는다(c: 연결, sid: string, 폴더: string): Promise<{ files: 산출물[]; errors: string[] }> {
  const 끝 = Date.now() + 가라앉기.산출물_ms;
  let v = (await 부른다(c, 'GET', `/api/sessions/${encodeURIComponent(sid)}/artifacts`)) as 산출물목록 | null;
  while (v?.ready === false) {
    if (Date.now() >= 끝) throw new Error(`팜이 session ${sid} 산출물을 ${가라앉기.산출물_ms / 1000}초 안에 다 만들지 못했다(ready:false) — 조금 뒤 다시 한다`);
    await new Promise((ok) => setTimeout(ok, 가라앉기.산출물간격_ms));
    v = (await 부른다(c, 'GET', `/api/sessions/${encodeURIComponent(sid)}/artifacts`)) as 산출물목록 | null;
  }
  const 목록 = v?.files ?? [];
  // 팜이 준 이름으로 파일을 만드니 폴더 밖으로 못 나가게 먼저 다 본다
  for (const f of 목록) {
    if (typeof f.name !== 'string' || f.name === '' || /[/\\]/.test(f.name) || f.name.includes('..')) throw new Error(`팜이 준 파일 이름을 쓸 수 없다: ${JSON.stringify(f.name)}`);
  }
  await mkdir(폴더, { recursive: true });
  const files: 산출물[] = [];
  for (const f of 목록) {
    const 주소 = new URL(f.url, c.base);
    // 토큰을 다른 곳에 보내지 않는다
    if (주소.origin !== new URL(c.base).origin) throw new Error(`${f.name} 주소가 팜 밖이다: ${주소.href}`);
    const res = await fetch(주소.href, { headers: c.headers, signal: AbortSignal.timeout(내려받기_ms) });
    if (!res.ok || res.body === null) throw new Error(`${f.name} 을 받지 못했다 — HTTP ${res.status}`);
    const path = join(폴더, f.name);
    await writeFile(path, res.body);
    const bytes = (await stat(path)).size;
    if (f.bytes !== undefined && f.bytes !== bytes) throw new Error(`${f.name} 크기가 맞지 않는다 — 받은 ${bytes} · 팜 ${f.bytes} bytes`);
    files.push({ name: f.name, bytes, path });
  }
  return { files, errors: (v?.errors ?? []).map((e) => (typeof e === 'string' ? e : JSON.stringify(e))) };
}

// open 이 띄운 앱 — session 답(없으면 보낸 capabilities)에서 읽는다. 앱을 비운 뒤 같은 intent 인자로 다시 띄우는 데 쓴다
export interface 띄운앱 {
  appPackage?: string;
  appActivity?: string;
  optionalIntentArguments?: string;
}

// am start extras 깃발 → UiAutomator2 `mobile: startActivity` extras 꼴 (sn 은 값 없음)
const extras꼴: Record<string, string> = { '-e': 's', '--es': 's', '--esn': 'sn', '--ez': 'z', '--ei': 'i', '--el': 'l', '--ef': 'f', '--eu': 'u' };

/**
 * 앱을 어떻게 다시 띄울까 — intent 인자와 activity 를 알면 `mobile: startActivity` 에 같은 extras 를 싣고, 모르면 `mobile: activateApp`.
 * 데모마켓은 intent 로 받은 서버 주소를 앱 데이터에 두어 clearApp 뒤 activateApp 하면 주소를 잃는다(F6-05 실측).
 * 앱을 비우기 전에 부른다 — 못 옮기는 인자면 앱을 건드리기 전에 던진다
 * intent 가 아니라 component 로 넘긴다 — intent 는 am 의 맨 앞 위치 인자가 되어 뒤의 extras 깃발이 버려진다(폰 답에 has extras 없음). component 면 `-n pkg/activity` 꼴(test_platform PR #503 실측)
 * ponytail: extras 깃발(-e · --es · --esn · --ez · --ei · --el · --ef · --eu)만 옮긴다 — 배열 · 깃발(-f · --activity-*) 인자가 나오면 늘린다
 */
export function 띄우기(꾸러미: string, 앱: 띄운앱 = {}): { script: 'mobile: startActivity' | 'mobile: activateApp'; arg: Record<string, unknown> } {
  if (앱.optionalIntentArguments === undefined || 앱.appActivity === undefined) return { script: 'mobile: activateApp', arg: { appId: 꾸러미 } };
  const 낱 = [...앱.optionalIntentArguments.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]!);
  const extras: string[][] = [];
  for (let i = 0; i < 낱.length; ) {
    const 꼴 = extras꼴[낱[i]!];
    const 수 = 꼴 === 'sn' ? 2 : 3;
    if (꼴 === undefined || i + 수 > 낱.length) {
      throw new Error(`optionalIntentArguments 의 「${낱.slice(i).join(' ')}」 를 mobile: startActivity extras 로 못 옮긴다 — -e · --es · --esn · --ez · --ei · --el · --ef · --eu 만`);
    }
    extras.push([꼴, ...낱.slice(i + 1, i + 수)]);
    i += 수;
  }
  return { script: 'mobile: startActivity', arg: { component: `${꾸러미}/${앱.appActivity}`, extras } };
}
