// crawl 이 화면 셋 그래프를 도는지(새 화면 · 연결 · back · 재시작 + 경로 다시 누르기 · 다른 앱 · 상한) · 안 누를 것 · 확인 창과 화면 키 규칙을 본다

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
  cls?: string;
  password?: boolean;
}

// 버튼 i 는 [0,(i+1)*100][100,(i+1)*100+50] — 가운데 y 로 몇 번째인지 되찾는다
function XML(틀: { desc?: string; id?: string }, 제목: string, 버튼들: 버튼[]): string {
  const 줄 = 버튼들.map(
    (b, i) =>
      `<android.widget.${b.cls ?? 'Button'} text="${b.text ?? ''}" content-desc="${b.desc ?? ''}" resource-id="${b.id ?? ''}" password="${b.password === true}" clickable="true" bounds="[0,${(i + 1) * 100}][100,${(i + 1) * 100 + 50}]" />`,
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
type 그래프 = Record<string, { 틀: { desc?: string; id?: string }; 제목: string; 버튼: 버튼[]; 길: Record<string, string> }>;
const 기본: 그래프 = {
  A: { 틀: { desc: 'a screen' }, 제목: 'Home', 버튼: [{ desc: 'to b' }, { text: 'To C' }, { desc: 'open web' }, { id: 'com.shop:id/same' }], 길: { 'to b': 'B', 'To C': 'C', 'open web': 'X' } },
  B: { 틀: { desc: 'b screen' }, 제목: 'Bee', 버튼: [{ desc: 'to c' }], 길: { 'to c': 'C' } },
  C: { 틀: { id: 'com.shop:id/c_root' }, 제목: 'Sea', 버튼: [{ text: 'c ok' }], 길: {} },
  X: { 틀: { desc: 'web' }, 제목: 'Chrome', 버튼: [], 길: {} },
};
// 확인 창 — 버튼은 화면 차례대로 취소(button2) · 확인(button1). 길 '<' 는 창이 닫힌다
const 창 = (글: string, 칸: 버튼[] = []): 그래프[string] => ({
  틀: {},
  제목: 글,
  버튼: [...칸, { id: 'android:id/button2', text: '취소' }, { id: 'android:id/button1', text: '확인' }],
  길: { 'android:id/button1': '<', 'android:id/button2': '<' },
});
// 안 누를 것 · 확인 창 · 탈퇴 흐름 · 로그인 풀림
const 위험앱: 그래프 = {
  A: {
    틀: { desc: 'a screen' },
    제목: 'Home',
    버튼: [
      { desc: 'menu item log out' },
      { text: '삭제' },
      { id: 'com.shop:id/btn_delete' },
      { desc: 'secret' },
      { text: '게시글을 삭제하는 방법 안내 보기' },
      { desc: 'ask' },
      { desc: 'wipe' },
      { desc: 'rename' },
      { desc: 'close my account' },
      { text: '회원 탈퇴 신청' },
      { desc: 'settings' },
      { desc: 'to login' },
    ],
    길: {
      'menu item log out': 'L', 삭제: 'L', 'com.shop:id/btn_delete': 'L', secret: 'L', '게시글을 삭제하는 방법 안내 보기': 'G',
      ask: 'D1', wipe: 'D2', rename: 'D3', 'close my account': 'D4', '회원 탈퇴 신청': 'W', settings: 'W2', 'to login': 'P',
    },
  },
  L: { 틀: { desc: 'logged out' }, 제목: 'Bye', 버튼: [], 길: {} },
  G: { 틀: { desc: 'guide screen' }, 제목: 'Guide', 버튼: [], 길: {} },
  D1: 창('저장할까요?'),
  D2: 창('모든 기록이 삭제됩니다'),
  D3: 창('새 이름', [{ cls: 'EditText', desc: 'name input' }]),
  D4: 창('Are you sure?'),
  W: { 틀: { desc: 'leave screen' }, 제목: '안내', 버튼: [{ desc: 'go' }], 길: {} },
  W2: { 틀: { desc: 'settings screen' }, 제목: '회원탈퇴', 버튼: [{ desc: 'confirm leave' }], 길: {} },
  P: { 틀: { desc: 'login screen' }, 제목: 'Login', 버튼: [{ cls: 'EditText', desc: 'username input' }, { cls: 'EditText', desc: 'password input', password: true }], 길: {} },
};
let 화면들 = 기본;
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
  if (다음 === '<') 쌓임.pop();
  else if (다음 !== undefined) 쌓임.push(다음);
}

beforeEach(async () => {
  Object.assign(가라앉기, { 최대_ms: 0, 간격_ms: 0 });
  process.chdir(mkdtempSync(join(tmpdir(), 'appium-cli-')));
  쌓임 = ['A'];
  화면들 = 기본;
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

  it('로그아웃 · 위험 글자 · --exclude 는 안 누르고, 확인 창은 확인 · back 으로 닫고, 탈퇴 흐름에서는 아무것도 안 누르고, 로그인 화면은 표시한다', async () => {
    화면들 = 위험앱;
    await run(['-s=c', 'crawl', '--exclude', '/SECRET/i', '--exclude', 'nothing'], env);

    expect(눌림).toEqual([
      'A 게시글을 삭제하는 방법 안내 보기', // 긴 글은 버튼이 아니다
      'A ask',
      'D1 android:id/button1', // 그냥 확인 창은 확인
      'A wipe', // 되돌릴 수 없음 — back
      'A rename', // 입력칸 — back
      'A close my account', // 탈퇴 이름으로 뜬 창 — back
      'A 회원 탈퇴 신청',
      'A settings',
      'A to login',
      'A 게시글을 삭제하는 방법 안내 보기', // G 로 가는 경로 다시 누르기
      'A to login', // W · W2 는 탈퇴 흐름이라 건너뛰고 P 로
      'P username input',
      'P password input',
    ]);
    const r = 결과();
    expect(r.dialogs).toEqual({ 누름: 1, 경고: 1, 입력: 1, 탈퇴: 1 });
    expect(r.screens.map((s) => [s.key, s.탈퇴흐름 ?? false, s.로그인풀림 ?? false])).toEqual([
      ['app:.Main/a screen', false, false],
      ['app:.Main/guide screen', false, false],
      ['app:.Main/leave screen', true, false],
      ['app:.Main/settings screen', true, false],
      ['app:.Main/login screen', false, true],
    ]);
  });

  it('확인 창 버튼이 그사이 사라져 못 누르면 back 으로 닫고 크롤을 이어 간다', async () => {
    화면들 = 위험앱;
    const 기본처리 = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
      url.endsWith('/element') && String(init.body).includes('android:id/button1')
        ? new Response(JSON.stringify({ value: { error: 'no such element', message: 'gone' } }), { status: 404 })
        : 기본처리(url, init),
    );

    await run(['-s=c', 'crawl'], env);

    expect(눌림).not.toContain('D1 android:id/button1');
    expect(결과().dialogs.누름).toBe(1);
    expect(결과().screens.length).toBeGreaterThan(1);
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
