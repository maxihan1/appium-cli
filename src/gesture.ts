// long-press · double-tap · wait · toast · 요소 안 손동작의 몸 — cli.ts 는 인자를 읽고 여기를 부르기만 한다

import { 가라앉기, 부른다, 화면을기다린다, type 연결 } from './appium.js';
import { 잠깐뜬글 } from './crawl-motion.js';
import type { 요소, 화면 } from './platform/android.js';

export const 쉰다 = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

/** kit `길게누르기` 의 기본 누르는 시간과 같다 */
export const 길게기본_ms = 1200;

export function 양의정수(값: string | undefined, 기본: number, 이름: string): number {
  const n = 값 === undefined ? 기본 : Number(값);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${이름} 은 1 이상의 정수(ms)다: ${값}`);
  return n;
}

// 손가락 하나가 (x, y) 에 내려와 동작을 이어 가는 W3C pointer actions — 좌표를누른다 와 같은 꼴이다
function 손가락(c: 연결, sid: string, x: number, y: number, 동작: object[]): Promise<unknown> {
  return 부른다(c, 'POST', `/session/${sid}/actions`, {
    actions: [{ type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' }, actions: [{ type: 'pointerMove', duration: 0, x, y }, ...동작] }],
  });
}

const 내림 = { type: 'pointerDown', button: 0 };
const 올림 = { type: 'pointerUp', button: 0 };
const 멈춤 = (duration: number): object => ({ type: 'pause', duration });

export const 길게누른다 = (c: 연결, sid: string, x: number, y: number, ms: number): Promise<unknown> => 손가락(c, sid, x, y, [내림, 멈춤(ms), 올림]);

// 두 번 사이를 너무 벌리면 두 번의 한 번씩으로 읽힌다 — 100ms 안쪽으로 붙인다
export const 두번누른다 = (c: 연결, sid: string, x: number, y: number): Promise<unknown> => 손가락(c, sid, x, y, [내림, 멈춤(50), 올림, 멈춤(100), 내림, 멈춤(50), 올림]);

/** `~desc` · `id=…` 선택자나 글자가 지금 화면에 있나. 화면 글만 보고 Appium 으로 찾지는 않는다 */
export function 맞추기(선택자: string | undefined, 글: string | undefined): (h: 화면) => boolean {
  const 맞다 = (e: 요소): boolean => {
    if (선택자 === undefined) return !e.비밀번호 && (e.text.includes(글!) || e.desc.includes(글!));
    if (선택자.startsWith('~')) return e.desc === 선택자.slice(1);
    // 글자 그대로만 맞춘다 — 케이스는 id 자동 완성을 끄고 돌아(disableIdLocatorAutocompletion) 짧은 이름으로는 `<pkg>:id/…` 를 못 찾는다
    return e.id === 선택자.slice('id='.length);
  };
  return (h) => Object.values(h.refs).some(맞다);
}

/** 화면을 되풀이해 읽어 맞음이 (사라짐이면 아니게) 될 때까지 기다린다. 걸린 ms 를 준다 — 시간 안에 안 되면 던진다 */
export async function 기다린다(c: 연결, sid: string, 라벨: string, 맞음: (h: 화면) => boolean | Promise<boolean>, 사라짐: boolean, 제한_ms: number): Promise<number> {
  const 시작 = Date.now();
  for (;;) {
    if ((await 맞음(await 화면을기다린다(c, sid))) !== 사라짐) return Date.now() - 시작;
    if (Date.now() - 시작 >= 제한_ms) throw new Error(`${라벨} — ${제한_ms / 1000}초 안에 ${사라짐 ? '사라지지 않았다' : '뜨지 않았다'}`);
    await 쉰다(가라앉기.간격_ms);
  }
}

/** kit 손동작 부품(요소안에서밀기 · 벌리기 · 오므리기)과 같은 정도 — Ran 줄을 옮기면 같은 길이로 움직인다 */
export const 손동작정도 = 0.75;

export const 밀방향들 = ['up', 'down', 'left', 'right'] as const;
export type 밀방향 = (typeof 밀방향들)[number];
export const 밀방향인가 = (x: string | undefined): x is 밀방향 => (밀방향들 as readonly string[]).includes(x ?? '');
/** kit `요소안에서밀기` 의 방향 이름 */
export const 방향말: Record<밀방향, string> = { up: '위', down: '아래', left: '왼쪽', right: '오른쪽' };
export const 방향으로: Record<밀방향, string> = { up: '위로', down: '아래로', left: '왼쪽으로', right: '오른쪽으로' };

/** `[x1,y1][x2,y2]` 를 mobile: 손짓이 받는 상자로 */
export function 상자(bounds: string): { left: number; top: number; width: number; height: number } | null {
  const n = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(bounds)?.slice(1).map(Number);
  if (n === undefined || n[2]! <= n[0]! || n[3]! <= n[1]!) return null;
  return { left: n[0]!, top: n[1]!, width: n[2]! - n[0]!, height: n[3]! - n[1]! };
}

/** UiAutomator2 `mobile:` 손짓 하나 — kit 부품이 driver.execute 로 보내는 것과 같은 요청이다 */
export const 손짓 = (c: 연결, sid: string, script: string, arg: Record<string, unknown>): Promise<unknown> => 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script, args: [arg] });

export const 토스트줄 = (글: string): string => `Toast: 「${글}」`;

/** 제한_ms 동안 화면을 되풀이해 읽어 본 토스트 글을 본 차례대로 준다(같은 글은 한 번). 하나라도 보면 토스트더_ms 만 더 보고 끝낸다 */
export async function 토스트를본다(c: 연결, sid: string, 제한_ms: number): Promise<string[]> {
  const 본 = new Set<string>();
  let 끝 = Date.now() + 제한_ms;
  let 봤다 = false;
  for (;;) {
    for (const 글 of 잠깐뜬글([await 화면을기다린다(c, sid)], '')) 본.add(글);
    if (!봤다 && 본.size > 0) {
      봤다 = true;
      끝 = Date.now() + 가라앉기.토스트더_ms;
    }
    if (Date.now() >= 끝) return [...본];
    await 쉰다(가라앉기.간격_ms);
  }
}
