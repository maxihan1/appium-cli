// Appium 서버에 W3C WebDriver 요청을 보내는 얇은 클라이언트. URL 안 계정은 Basic 헤더로 옮긴다

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
