// Appium 서버에 W3C WebDriver 요청을 보내는 얇은 클라이언트. URL 안 계정은 Basic 헤더로 옮긴다

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
  const v = (await 부른다(c, 'POST', `/session/${sid}/element`, { using, value })) as Record<string, string>;
  return v[ELEMENT] ?? v.ELEMENT!;
}

// Appium 은 session 마다 읽은 자리를 기억해 다음 호출엔 새 줄만 준다(실측: 첫 호출 10,000줄 — 버퍼 상한)
export async function logcat을읽는다(c: 연결, sid: string): Promise<string[]> {
  const v = (await 부른다(c, 'POST', `/session/${encodeURIComponent(sid)}/se/log`, { type: 'logcat' })) as { message: string }[] | null;
  return (v ?? []).map((e) => e.message);
}

// 테스트가 줄일 수 있게 묶어 둔다. 찾기_ms 는 선택자로 찾을 때 — 앱 데이터를 지운 뒤 처음 뜨는 데 몇 초 걸린다
export const 가라앉기 = { 최대_ms: 3000, 간격_ms: 300, 찾기_ms: 10_000 };

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
