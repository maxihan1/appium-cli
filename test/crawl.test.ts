// crawl 이 화면 셋 그래프를 도는지(새 화면 · 연결 · back · 재시작 + 경로 다시 누르기 · 다른 앱 · 상한)와 화면 키 규칙을 본다

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { 가라앉기 } from '../src/appium.js';
import { run } from '../src/cli.js';
import { type 크롤결과, 화면을가린다 } from '../src/crawl.js';
import { parseSource } from '../src/platform/android.js';

interface 버튼 {
  desc?: string;
  id?: string;
  text?: string;
}

// 버튼 i 는 [0,(i+1)*100][100,(i+1)*100+50] — 가운데 y 로 몇 번째인지 되찾는다
function XML(틀: { desc?: string; id?: string }, 제목: string, 버튼들: 버튼[]): string {
  const 줄 = 버튼들.map(
    (b, i) =>
      `<android.widget.Button text="${b.text ?? ''}" content-desc="${b.desc ?? ''}" resource-id="${b.id ?? ''}" clickable="true" bounds="[0,${(i + 1) * 100}][100,${(i + 1) * 100 + 50}]" />`,
  );
  return `<hierarchy width="1080" height="2400">
  <android.widget.FrameLayout text="" content-desc="" resource-id="android:id/content" clickable="false" bounds="[0,0][1080,2400]">
    <android.view.ViewGroup text="" content-desc="${틀.desc ?? ''}" resource-id="${틀.id ?? ''}" clickable="false" bounds="[0,0][1080,2000]">
      <android.widget.TextView text="${제목}" content-desc="" resource-id="" clickable="false" bounds="[0,0][500,50]" />
      ${줄.join('\n      ')}
    </android.view.ViewGroup>
  </android.widget.FrameLayout>
</hierarchy>`;
}

// A → B(~to b) · A → C(글자만 — 좌표) · A → 다른 앱 · A 안에서 그대로(id) · B → C · C 에서는 back 이 안 먹는다
const 화면들: Record<string, { 틀: { desc?: string; id?: string }; 제목: string; 버튼: 버튼[]; 길: Record<string, string> }> = {
  A: { 틀: { desc: 'a screen' }, 제목: 'Home', 버튼: [{ desc: 'to b' }, { text: 'To C' }, { desc: 'open web' }, { id: 'com.shop:id/same' }], 길: { 'to b': 'B', 'To C': 'C', 'open web': 'X' } },
  B: { 틀: { desc: 'b screen' }, 제목: 'Bee', 버튼: [{ desc: 'to c' }], 길: { 'to c': 'C' } },
  C: { 틀: { id: 'com.shop:id/c_root' }, 제목: 'Sea', 버튼: [{ text: 'c ok' }], 길: {} },
  X: { 틀: { desc: 'web' }, 제목: 'Chrome', 버튼: [], 길: {} },
};
const 이름 = (b: 버튼): string => b.desc || b.id || b.text || '';

const fetchMock = vi.fn();
const env = { PLATFORM_APPIUM_URL: 'http://farm:4723/wd/hub', PLATFORM_APP: '/apk/dev.apk' };
const 답 = (value: unknown): Response => new Response(JSON.stringify({ value }));
let 쌓임: string[] = [];
let 눌림: string[] = [];
let 부름: string[] = [];

function 누름(i: number): void {
  const 위 = 쌓임.at(-1)!;
  const b = 화면들[위]!.버튼[i]!;
  눌림.push(`${위} ${이름(b)}`);
  const 다음 = 화면들[위]!.길[이름(b)];
  if (다음 !== undefined) 쌓임.push(다음);
}

beforeEach(async () => {
  Object.assign(가라앉기, { 최대_ms: 0, 간격_ms: 0 });
  process.chdir(mkdtempSync(join(tmpdir(), 'appium-cli-')));
  쌓임 = ['A'];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace('http://farm:4723/wd/hub', '');
    const body = init.body === undefined ? {} : (JSON.parse(init.body as string) as Record<string, unknown>);
    const 위 = 쌓임.at(-1)!;
    if (path === '/session') return 답({ sessionId: 's-1' });
    if (path.endsWith('/source')) {
      const h = 화면들[위]!;
      return 답(XML(h.틀, h.제목, h.버튼));
    }
    if (path.endsWith('/current_activity')) return 답(위 === 'X' ? '.Browser' : '.Main');
    if (path.endsWith('/current_package')) return 답(위 === 'X' ? 'com.android.chrome' : 'com.shop');
    if (path.endsWith('/element')) return 답({ 'element-6066-11e4-a5ab-c8d2b5b44a87': String(화면들[위]!.버튼.findIndex((b) => (b.desc ?? b.id) === body.value)) });
    const 눌린요소 = /\/element\/(\d+)\/click$/.exec(path);
    if (눌린요소) 누름(Number(눌린요소[1]));
    if (path.endsWith('/actions')) {
      const 손 = (body.actions as { actions: { y?: number }[] }[])[0]!.actions[0]!;
      누름((손.y! - 25) / 100 - 1);
    }
    if (path.endsWith('/back')) {
      부름.push('back');
      if (위 !== 'C' && 쌓임.length > 1) 쌓임.pop();
    }
    if (path.endsWith('/execute/sync')) {
      const { script, args } = body as { script: string; args: { appId: string }[] };
      부름.push(`${script} ${args[0]!.appId}`);
      쌓임 = script === 'mobile: terminateApp' ? [] : ['A'];
    }
    return 답(null);
  });
  vi.stubGlobal('fetch', fetchMock);
  await run(['-s=c', 'open'], env);
  눌림 = [];
  부름 = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const 결과 = (): 크롤결과 => JSON.parse(readFileSync('.appium-cli/crawl.json', 'utf8')) as 크롤결과;

describe('crawl', () => {
  it('화면 셋을 키 · 이름 · 경로로 남기고 화면 연결을 버튼 이름으로 잇는다', async () => {
    const out = await run(['-s=c', 'crawl'], env);

    expect(out).toMatch(/^크롤 — 화면 3장 · 연결 3개 · 누름 6번 · 재시작 2번 · [\d.]+초 → \.appium-cli\/crawl\.json\n- Snapshot: /);
    const r = 결과();
    expect(r.app).toBe('com.shop');
    expect(r.stopped).toBeNull();
    expect(r.screens.map((s) => [s.key, s.name, s.path])).toEqual([
      ['app:.Main/a screen', 'Home', []],
      ['app:.Main/b screen', 'Bee', ['to b']],
      ['app:.Main/com.shop:id/c_root', 'Sea', ['To C']],
    ]);
    expect(r.links).toEqual([
      { from: 'app:.Main/a screen', to: 'app:.Main/b screen', via: '버튼 「to b」' },
      { from: 'app:.Main/a screen', to: 'app:.Main/com.shop:id/c_root', via: '버튼 「To C」' },
      { from: 'app:.Main/b screen', to: 'app:.Main/com.shop:id/c_root', via: '버튼 「to c」' },
    ]);
  });

  it('back 으로 돌아오고, 못 돌아오면 앱을 다시 띄워 경로를 다시 누르고, 다른 앱이면 back 하고, 같은 후보는 두 번 누르지 않는다', async () => {
    await run(['-s=c', 'crawl'], env);

    // 'A to b' 둘째는 B 로 가는 경로 다시 누르기다. 화면 안에서 그대로인 누르기(same · c ok) 뒤에는 back 하지 않는다
    expect(눌림).toEqual(['A to b', 'A To C', 'A open web', 'A com.shop:id/same', 'A to b', 'B to c', 'C c ok']);
    expect(부름).toEqual([
      'back', // B → A
      'back', // C 에서 안 먹는다
      'mobile: terminateApp com.shop',
      'mobile: activateApp com.shop', // A 로 다시 (경로 없음)
      'back', // 다른 앱 → A
      'mobile: terminateApp com.shop',
      'mobile: activateApp com.shop', // B 로 가려고 다시 띄우고 'to b'
      'back', // C 에서 안 먹는다 — 다음 차례가 C 라 그대로 둔다
    ]);
  });

  it('--max 장에 닿으면 멈춘다', async () => {
    const out = await run(['-s=c', 'crawl', '--max', '2'], env);

    expect(out).toContain('(멈춤: --max 2장)');
    expect(결과().screens.map((s) => s.key)).toEqual(['app:.Main/a screen', 'app:.Main/b screen']);
  });

  it('--max 는 1 ~ 100 장만 받는다', async () => {
    fetchMock.mockClear();
    await expect(run(['-s=c', 'crawl', '--max', '101'], env)).rejects.toThrow('--max 는 1 ~ 100 장이다');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('화면을가린다', () => {
  it('누르지 못하는 컨테이너의 desc 가 id 보다 앞서고, 이름은 그 안 첫 TextView 다', () => {
    const xml = XML({ desc: 'login screen', id: 'com.shop:id/root' }, 'Login', [{ desc: 'big button' }]);

    expect(화면을가린다(parseSource(xml), '.MainActivity')).toMatchObject({ key: 'app:.MainActivity/login screen', name: 'Login' });
  });

  it('desc 가 없으면 앱 resource-id 를 쓰고 android:id/… 는 쓰지 않는다', () => {
    expect(화면을가린다(parseSource(XML({ id: 'com.shop:id/cart' }, 'Cart', [])), '.Main').key).toBe('app:.Main/com.shop:id/cart');
  });

  it('이름표가 없으면 구조 지문 — 글자 · 숫자만 바뀌면 같고 짜임이 바뀌면 다르다', () => {
    const 키 = (제목: string, 버튼들: 버튼[]): string => 화면을가린다(parseSource(XML({}, 제목, 버튼들)), '.Main').key;
    const 처음 = 키('3 items', [{ text: 'Buy 1' }]);

    expect(처음).toMatch(/^app:\.Main\/[0-9a-f]{12}$/);
    expect(키('12 things', [{ text: 'Sell 20' }])).toBe(처음);
    expect(키('3 items', [{ text: 'Buy 1' }, { text: 'Buy 2' }])).not.toBe(처음);
  });
});
