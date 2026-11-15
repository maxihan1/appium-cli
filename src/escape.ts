// 빠져나갈 길 — 요소 안 자리를 긋는 draw 와 읽기만 하는 mobile: 명령을 부르는 exec 의 몸. cli.ts 는 인자를 읽고 여기를 부르기만 한다

import { 부른다, type 연결 } from './appium.js';

export type 점 = [number, number];
export interface 상자 { x: number; y: number; width: number; height: number }

/** kit `요소위에그리기` 와 같은 때 — 누른 뒤 쉬고, 점 사이를 이 시간에 걸쳐 옮긴다. 너무 빠르면 서명 칸이 획을 튕김(fling)으로 읽는다 */
export const 긋기_ms = { 누름: 100, 구간: 200 };

/** `10,50` 꼴 인자들을 요소 안 %(0~100) 점으로 — 틀리면 던진다 */
export function 점들을읽는다(인자: string[]): 점[] {
  if (인자.length === 0) throw new Error('draw 에 점이 하나 이상 필요하다 — draw <ref|선택자> 10,50 90,50 (요소 안 %)');
  return 인자.map((x) => {
    const m = /^(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/.exec(x);
    const p = m === null ? null : ([Number(m[1]), Number(m[2])] as 점);
    if (p === null || p.some((n) => n > 100)) throw new Error(`draw 의 점은 요소 안 %(0~100) 두 수를 쉼표로 붙인 꼴이다(10,50): ${x}`);
    return p;
  });
}

/** 요소 상자 안의 % 점을 화면 좌표로 — kit 과 같은 셈이라 Ran 줄을 옮기면 같은 자리를 긋는다. 100% 는 상자 밖이 안 되게 마지막 화소로 */
export const 자리들 = (r: 상자, 점들: 점[]): { x: number; y: number }[] =>
  점들.map(([px, py]) => ({ x: Math.round(r.x + Math.min(r.width - 1, (r.width * px) / 100)), y: Math.round(r.y + Math.min(r.height - 1, (r.height * py) / 100)) }));

/** W3C pointer actions — 점 하나면 짧게 누르기, 여럿이면 누른 채 차례로 옮기고 뗀다 */
export function 긋기동작(자리: { x: number; y: number }[]): object[] {
  const [첫, ...뒤] = 자리;
  const 내림 = { type: 'pointerDown', button: 0 };
  const 올림 = { type: 'pointerUp', button: 0 };
  const 가운데 = 뒤.length === 0 ? [{ type: 'pause', duration: 50 }] : [{ type: 'pause', duration: 긋기_ms.누름 }, ...뒤.map((p) => ({ type: 'pointerMove', duration: 긋기_ms.구간, x: p.x, y: p.y }))];
  return [{ type: 'pointerMove', duration: 0, x: 첫!.x, y: 첫!.y }, 내림, ...가운데, 올림];
}

export const 긋는다 = (c: 연결, sid: string, 자리: { x: number; y: number }[]): Promise<unknown> =>
  부른다(c, 'POST', `/session/${sid}/actions`, { actions: [{ type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' }, actions: 긋기동작(자리) }] });

/** 화면 글의 `[x1,y1][x2,y2]` 를 상자로 — 주소 없는 ref 를 그을 때만 쓴다 */
export function 테두리상자(bounds: string): 상자 | null {
  const n = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(bounds)?.slice(1).map(Number);
  if (n === undefined || n[2]! <= n[0]! || n[3]! <= n[1]!) return null;
  return { x: n[0]!, y: n[1]!, width: n[2]! - n[0]!, height: n[3]! - n[1]! };
}

export const 점글 = (점들: 점[]): string => `[${점들.map(([x, y]) => `[${x}, ${y}]`).join(', ')}]`;

/** exec 가 받는 명령 — 폰을 바꾸지 않고 읽기만 한다. 살펴보기 전용이라 케이스에 옮기지 않는다 */
export const 읽기명령 = new Set(['getCurrentActivity', 'getCurrentPackage', 'getNotifications', 'getSystemBars', 'getDisplayDensity', 'getAppStrings', 'isAppInstalled', 'queryAppState', 'getContexts', 'deviceInfo', 'batteryInfo']);

/** 이미 CLI 명령 · kit 부품이 있는 명령 — exec 대신 그쪽을 쓰게 알린다(부품이 되돌리기 · 막힘 까닭을 맡는다) */
const 대신: Record<string, string> = {
  shell: '폰 셸은 열지 않는다',
  changePermissions: 'permission grant|revoke · 케이스는 권한상태에서',
  getPermissions: 'permission',
  setConnectivity: 'phone network · 케이스는 폰상태에서',
  getConnectivity: 'phone',
  setGeolocation: 'phone location · 케이스는 폰상태에서',
  resetGeolocation: 'phone location reset',
  setUiMode: 'phone dark · 케이스는 폰상태에서',
  getUiMode: 'phone',
  getDeviceTime: 'phone time · 케이스는 폰시각',
  clearApp: 'app clear · 케이스는 앱비우기',
  startActivity: '케이스는 인자로켜기',
  deepLink: 'deeplink · 케이스는 딥링크열기',
  backgroundApp: 'background · 케이스는 뒤로보냈다오기',
  lock: 'screen-off-on · 케이스는 화면껐다켜기',
  unlock: 'screen-off-on · 케이스는 화면껐다켜기',
  installApp: 'reinstall · 케이스는 앱다시깔기',
  removeApp: 'reinstall · 케이스는 앱다시깔기',
  terminateApp: 'app restart · 케이스는 앱다시켜기',
  activateApp: 'app front',
  openNotifications: 'notifications · 케이스는 알림창열기',
  getClipboard: 'clipboard · 케이스는 클립보드읽기',
  setClipboard: 'clipboard write · 케이스는 클립보드쓰기',
  pressKey: 'press · 케이스는 키누르기',
  type: 'type · 케이스는 포커스칸에치기',
  longClickGesture: 'long-press · 케이스는 길게누르기',
  doubleClickGesture: 'double-tap · 케이스는 두번누르기',
  swipeGesture: 'swipe-in · 케이스는 요소안에서밀기',
  dragGesture: 'drag · 케이스는 끌어놓기',
  pinchOpenGesture: 'pinch-open · 케이스는 벌리기',
  pinchCloseGesture: 'pinch-close · 케이스는 오므리기',
  scrollGesture: 'scroll-to · 케이스는 스크롤해서찾기',
  pushFile: 'file push · 케이스는 폰에파일넣기',
  deleteFile: 'file rm',
};

/** `mobile: 이름` · `이름` 을 받아 허용 목록에 든 이름만 준다 */
export function 읽기명령이름(x: string | undefined): string {
  const 이름 = (x ?? '').replace(/^mobile:\s*/, '');
  if (읽기명령.has(이름)) return 이름;
  const 길 = 대신[이름];
  if (길 !== undefined) throw new Error(`exec 는 mobile: ${이름} 을 부르지 않는다 — ${길}`);
  throw new Error(`exec 는 읽기만 하는 명령만 부른다: ${[...읽기명령].join(' · ')} — 받은 것: ${x ?? '(없음)'}`);
}

export function 인자를읽는다(x: string | undefined): Record<string, unknown> {
  if (x === undefined) return {};
  let v: unknown;
  try {
    v = JSON.parse(x);
  } catch {
    throw new Error(`exec 의 인자는 JSON 객체다: ${x}`);
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`exec 의 인자는 JSON 객체다: ${x}`);
  return v as Record<string, unknown>;
}

export async function 읽기명령을부른다(c: 연결, sid: string, 이름: string, 인자: Record<string, unknown>): Promise<string> {
  const 답 = await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script: `mobile: ${이름}`, args: [인자] });
  return [`Ran: // 살펴보기 전용 — 케이스에 옮기지 않는다 (mobile: ${이름})`, JSON.stringify(답 ?? null, null, 2)].join('\n');
}
