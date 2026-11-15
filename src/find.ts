// 찾기 · 확인 명령의 몸 — 선택자가 몇 개 맞나 · 보이나 · 먼저 뜨는 것 · 폰 조회. cli.ts 는 인자를 읽고 여기를 부르기만 한다

import { 가라앉기, 부른다, type 연결 } from './appium.js';
import { w3c, type 요소 } from './platform/android.js';

const ELEMENT = 'element-6066-11e4-a5ab-c8d2b5b44a87';
const 쉰다 = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));
const 까닭 = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** kit `스크롤해서찾기` 와 같은 선택자 — 굴릴 수 있는 첫 목록을 그 글자가 보일 때까지 굴린다 */
export const 굴려찾기선택자 = (글자: string): string =>
  `android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().textContains(${JSON.stringify(글자)}))`;

/** 선택자에 맞는 요소 번호 전부 — 없으면 빈 배열(W3C find elements 는 못 찾아도 던지지 않는다) */
export async function 모두찾는다(c: 연결, sid: string, 선택자: string): Promise<string[]> {
  const v = (await 부른다(c, 'POST', `/session/${sid}/elements`, w3c(선택자))) as Record<string, string>[] | null;
  return (v ?? []).map((x) => x[ELEMENT] ?? x.ELEMENT!);
}

async function 자리(c: 연결, sid: string, id: string): Promise<string> {
  const r = (await 부른다(c, 'GET', `/session/${sid}/element/${id}/rect`)) as { x: number; y: number; width: number; height: number };
  return `[${r.x},${r.y}][${r.x + r.width},${r.y + r.height}]`;
}

/**
 * 몇 개 맞나와 맞은 자리 — 자리마다 마지막 화면에서 같은 자리의 ref 를 붙인다(부모 꼴 · 뜨는 창 꼴이 노린 요소를 잡는지 본다).
 * 하나만 맞아야 케이스에 쓴다(test_platform SPEC 공통/2-명세선언 「Android 앱 케이스」 ③ · ⑦)
 */
export async function 세어본다(c: 연결, sid: string, 선택자: string, refs: Record<string, 요소>): Promise<{ 수: number; 줄: string[] }> {
  const ids = await 모두찾는다(c, sid, 선택자);
  const 줄: string[] = [];
  for (const id of ids) {
    const b = await 자리(c, sid, id);
    const 같은 = Object.entries(refs).filter(([, e]) => e.bounds === b).map(([ref]) => ref);
    줄.push(`- ${b} — ${같은.length === 0 ? '마지막 화면에 없는 자리' : 같은.join(' · ')}`);
  }
  return { 수: ids.length, 줄 };
}

export const 셈줄 = (수: number): string =>
  `Count: ${수} — ${수 === 0 ? '못 찾았다' : 수 === 1 ? '하나만 맞는다' : '겹친다. 하나만 맞아야 케이스에 쓴다'}`;

/** kit `보이나` 와 같다 — 기다리지 않고 첫 요소가 있고 보이는지만 본다 */
export async function 보인다(c: 연결, sid: string, 선택자: string): Promise<boolean> {
  const [id] = await 모두찾는다(c, sid, 선택자);
  if (id === undefined) return false;
  return (await 부른다(c, 'GET', `/session/${sid}/element/${id}/displayed`)) === true;
}

/** kit `먼저뜨는것` 과 같다 — 후보를 차례로 보며 먼저 보이는 선택자. 시간 안에 없으면 던진다 */
export async function 먼저뜬다(c: 연결, sid: string, 후보: string[], 제한_ms: number): Promise<string> {
  const 끝 = Date.now() + 제한_ms;
  for (;;) {
    for (const 선택자 of 후보) if (await 보인다(c, sid, 선택자)) return 선택자;
    if (Date.now() >= 끝) throw new Error(`후보 ${후보.length}개 가운데 ${제한_ms / 1000}초 안에 뜬 것이 없다`);
    await 쉰다(가라앉기.간격_ms);
  }
}

const 앱상태: Record<number, string> = { 0: '깔려 있지 않다', 1: '꺼져 있다', 2: '뒤에서 멈춰 있다', 3: '뒤에서 돈다', 4: '앞에 떠 있다' };
// Android BatteryManager 의 BATTERY_STATUS_* 값
const 충전: Record<number, string> = { 1: '모름', 2: '충전 중', 3: '방전 중', 4: '충전 안 함', 5: '가득' };

/** 한 줄씩 묻고 실패한 줄은 「모름 — 까닭」으로 둔다 — 팜이 막는 명령 하나 때문에 나머지를 못 보지 않게 */
export async function 조회한다(c: 연결, sid: string, 꾸러미?: string): Promise<string> {
  const 실행 = (script: string, arg: Record<string, unknown> = {}): Promise<unknown> => 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script, args: [arg] });
  const 줄 = async (이름: string, 값: () => Promise<string>): Promise<string> => `${이름}: ${await 값().catch((e: unknown) => `모름 — ${까닭(e)}`)}`;
  return [
    await 줄('앱', async () => {
      const 앱 = 꾸러미 ?? String(await 부른다(c, 'GET', `/session/${sid}/appium/device/current_package`));
      const n = Number(await 실행('mobile: queryAppState', { appId: 앱 }));
      return `${앱} — ${앱상태[n] ?? `상태 ${n}`} (await driver.queryAppState('${앱}') → ${n})`;
    }),
    await 줄('화면', async () => String(await 부른다(c, 'GET', `/session/${sid}/appium/device/current_activity`))),
    await 줄('키보드', async () => `${(await 부른다(c, 'GET', `/session/${sid}/appium/device/is_keyboard_shown`)) === true ? '올라와 있다' : '내려가 있다'} (await driver.isKeyboardShown())`),
    await 줄('폰', async () => {
      const d = (await 실행('mobile: deviceInfo')) as Record<string, unknown>;
      return [d.manufacturer, d.model, `Android ${String(d.platformVersion ?? '?')}`, d.realDisplaySize].filter((x) => x !== undefined && x !== '').join(' · ');
    }),
    await 줄('배터리', async () => {
      const b = (await 실행('mobile: batteryInfo')) as { level?: number; state?: number };
      return `${Math.round((b.level ?? 0) * 100)}% · ${충전[b.state ?? 1] ?? '모름'}`;
    }),
  ].join('\n');
}
