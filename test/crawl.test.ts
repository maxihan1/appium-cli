// crawl 이 화면 셋 그래프를 도는지(새 화면 · 연결 · back · 지름길 · 재시작 + 경로 다시 누르기 · 다른 앱 · 상한 · 스크롤) · 안 누를 것 · 확인 창과 화면 키 규칙을 본다

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { 가라앉기 } from '../src/appium.js';
import { run } from '../src/cli.js';
import { type 크롤결과, 화면을가린다, 후보들 } from '../src/crawl.js';
import { screenKey } from '../src/index.js';
import { parseSource } from '../src/platform/android.js';

interface 버튼 {
  desc?: string;
  id?: string;
  text?: string;
  cls?: string;
  password?: boolean;
  // 누르면 logcat 에 찍히는 API 경로
  api?: string;
}

// 버튼 i 는 [0,(i+1)*100][100,(i+1)*100+50] — 가운데 y 로 몇 번째인지 되찾는다. 목록 줄(보이는 것만)은 버튼 뒤 번호로 스크롤 요소 안에 든다
function XML(틀: { desc?: string; id?: string }, 제목: string, 버튼들: 버튼[], 목록줄?: 버튼[]): string {
  const 칸 = (b: 버튼, i: number): string =>
    `<android.widget.${b.cls ?? 'Button'} text="${b.text ?? ''}" content-desc="${b.desc ?? ''}" resource-id="${b.id ?? ''}" password="${b.password === true}" clickable="true" bounds="[0,${(i + 1) * 100}][100,${(i + 1) * 100 + 50}]" />`;
  const 줄 = 버튼들.map(칸);
  if (목록줄 !== undefined) {
    줄.push(
      `<androidx.recyclerview.widget.RecyclerView text="" content-desc="" resource-id="" clickable="false" scrollable="true" bounds="[0,${(버튼들.length + 1) * 100}][1080,1990]">${목록줄.map((b, j) => 칸(b, 버튼들.length + j)).join('')}</androidx.recyclerview.widget.RecyclerView>`,
    );
  }
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
// 목록 = 스크롤 요소 안 줄 — 한 번에 창크기 줄만 보이고 위로 밀면 창크기만큼 내려간다(끝에서 멈춘다)
type 그래프 = Record<string, { 틀: { desc?: string; id?: string }; 제목: string; 버튼: 버튼[]; 길: Record<string, string>; 목록?: 버튼[] }>;
const 기본: 그래프 = {
  A: {
    틀: { desc: 'a screen' },
    제목: 'Home',
    버튼: [{ desc: 'to b', api: 'b-load' }, { text: 'To C' }, { desc: 'open web', api: 'web' }, { id: 'com.shop:id/same', api: 'same-tap' }],
    길: { 'to b': 'B', 'To C': 'C', 'open web': 'X' },
  },
  B: { 틀: { desc: 'b screen' }, 제목: 'Bee', 버튼: [{ desc: 'to c', api: 'c-load' }], 길: { 'to c': 'C' } },
  C: { 틀: { id: 'com.shop:id/c_root' }, 제목: 'Sea', 버튼: [{ text: 'c ok' }], 길: {} },
  X: { 틀: { desc: 'web' }, 제목: 'Chrome', 버튼: [], 길: {} },
};
// 확인 창 — 버튼은 화면 차례대로 취소(button2) · 확인(button1). 길 '<' 는 창이 닫힌다, '>X' 는 닫히며 X 가 뜬다
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
// 로그인 앱 — 로그인하면 안화면들로 그린다. 길 '로그인' 은 user · pass 가 맞으면 로그인해 첫 화면으로, '로그아웃' 은 로그인 화면으로
const 밖: 그래프 = {
  A: { 틀: { desc: 'home' }, 제목: 'Home', 버튼: [{ desc: 'to menu' }, { desc: 'to cart' }], 길: { 'to menu': 'M', 'to cart': 'K' } },
  M: {
    틀: { desc: 'menu' },
    제목: 'Menu',
    버튼: [{ desc: 'log in' }, { desc: 'menu item log out' }, { desc: 'about' }],
    길: { 'log in': 'P', 'menu item log out': '로그아웃', about: 'AB' },
  },
  P: {
    틀: { desc: 'login screen' },
    제목: 'Login',
    버튼: [{ cls: 'EditText', desc: 'user' }, { cls: 'EditText', desc: 'pass', password: true }, { desc: 'login button' }],
    길: { 'login button': '로그인' },
  },
  K: { 틀: { desc: 'cart' }, 제목: 'Cart', 버튼: [{ desc: 'checkout' }], 길: { checkout: 'P' } },
  AB: { 틀: { desc: 'about' }, 제목: 'About', 버튼: [], 길: {} },
};
const 안: 그래프 = {
  ...밖,
  A: { ...밖.A!, 버튼: [...밖.A!.버튼, { desc: 'profile' }], 길: { ...밖.A!.길, profile: 'PR' } },
  K: { ...밖.K!, 길: { checkout: 'CH' } },
  CH: { 틀: { desc: 'checkout' }, 제목: 'Checkout', 버튼: [], 길: {} },
  PR: { 틀: { desc: 'profile' }, 제목: 'Profile', 버튼: [], 길: {} },
};
let 화면들 = 기본;
let 안화면들: 그래프 | null = null;
let 로그인됨 = false;
let 입력: Record<string, string> = {};
let clearApp막힘 = false;
const 그래프 = (): 그래프 => (로그인됨 && 안화면들 !== null ? 안화면들 : 화면들);
const 이름 = (b: 버튼): string => b.desc || b.id || b.text || '';
let 창크기 = 3;
// 화면마다 목록이 내려간 줄 수 — 새로 가면 0, 앱을 다시 띄우면 다 0, back 으로 돌아오면 남는다(돌아옴자리버림이면 0)
let 내림: Record<string, number> = {};
let 돌아옴자리버림 = false;
const 보이는목록 = (위: string): 버튼[] | undefined => 그래프()[위]!.목록?.slice(내림[위] ?? 0, (내림[위] ?? 0) + 창크기);
const 보임 = (위: string): 버튼[] => [...그래프()[위]!.버튼, ...(보이는목록(위) ?? [])];

const fetchMock = vi.fn();
const env = { PLATFORM_APPIUM_URL: 'http://farm:4723/wd/hub', PLATFORM_APP: '/apk/dev.apk' };
const 답 = (value: unknown): Response => new Response(JSON.stringify({ value }));
let 쌓임: string[] = [];
let 눌림: string[] = [];
let 부름: string[] = [];
let 로그: string[] = [];

function 누름(i: number): void {
  const 위 = 쌓임.at(-1)!;
  const b = 보임(위)[i]!;
  눌림.push(`${위} ${이름(b)}`);
  if (b.api !== undefined) 로그.push(`10-20 10:07:55.318  4242  4300 I okhttp.OkHttpClient: --> GET https://api.shop/${b.api}?token=t1`);
  const 다음 = 그래프()[위]!.길[이름(b)];
  if (다음 === '<') 쌓임.pop();
  else if (다음?.startsWith('>')) 쌓임.splice(-1, 1, 다음.slice(1)); // 창이 닫히며 다음 창이 뜬다
  else if (다음 === '로그인') {
    if (입력.user === 'bob' && 입력.pass === 'secret') [로그인됨, 쌓임] = [true, ['A']];
  } else if (다음 === '로그아웃') {
    로그인됨 = false;
    쌓임.push('P');
  } else if (다음 !== undefined) {
    쌓임.push(다음);
    내림[다음] = 0;
  }
}

beforeEach(async () => {
  Object.assign(가라앉기, { 최대_ms: 0, 간격_ms: 0 });
  process.chdir(mkdtempSync(join(tmpdir(), 'appium-cli-')));
  쌓임 = ['A'];
  화면들 = 기본;
  [안화면들, 로그인됨, 입력, clearApp막힘, 창크기, 내림, 돌아옴자리버림] = [null, false, {}, false, 3, {}, false];
  로그 = ['10-20 10:00:00.000  4242  4300 I okhttp.OkHttpClient: --> GET https://api.shop/old'];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace('http://farm:4723/wd/hub', '');
    const body = init.body === undefined ? {} : (JSON.parse(init.body as string) as Record<string, unknown>);
    const 위 = 쌓임.at(-1)!;
    if (path === '/session') return 답({ sessionId: 's-1' });
    if (path.endsWith('/se/log')) {
      const 줄 = 로그.map((message) => ({ timestamp: 0, level: 'ALL', message }));
      로그 = [];
      return 답(줄);
    }
    if (path.endsWith('/source')) {
      const h = 그래프()[위]!;
      return 답(XML(h.틀, h.제목, h.버튼, 보이는목록(위)));
    }
    if (path.endsWith('/current_activity')) return 답(위 === 'X' ? '.Browser' : '.Main');
    if (path.endsWith('/current_package')) return 답(위 === 'X' ? 'com.android.chrome' : 'com.shop');
    if (path.endsWith('/element')) {
      const i = 보임(위).findIndex((b) => (b.desc ?? b.id) === body.value);
      return i < 0 ? new Response(JSON.stringify({ value: { error: 'no such element', message: 'none' } }), { status: 404 }) : 답({ 'element-6066-11e4-a5ab-c8d2b5b44a87': String(i) });
    }
    const 넣은요소 = /\/element\/(\d+)\/value$/.exec(path);
    if (넣은요소) 입력[이름(보임(위)[Number(넣은요소[1])]!)] = String(body.text);
    const 눌린요소 = /\/element\/(\d+)\/click$/.exec(path);
    if (눌린요소) 누름(Number(눌린요소[1]));
    if (path.endsWith('/actions')) {
      const 손 = (body.actions as { actions: { y?: number }[] }[])[0]!.actions[0]!;
      누름((손.y! - 25) / 100 - 1);
    }
    if (path.endsWith('/hide_keyboard')) 부름.push('hide-keyboard');
    if (path.endsWith('/back')) {
      부름.push('back');
      if (위 !== 'C' && 쌓임.length > 1) 쌓임.pop();
      if (돌아옴자리버림) 내림[쌓임.at(-1)!] = 0;
    }
    if (path.endsWith('/execute/sync')) {
      const { script, args } = body as { script: string; args: { appId?: string; direction?: string }[] };
      if (script === 'mobile: performEditorAction') {
        부름.push(`${script} ${(args[0] as { action?: string }).action}`);
        return 답(null);
      }
      if (script === 'mobile: swipeGesture') {
        부름.push(`swipe ${args[0]!.direction}`);
        내림[위] = Math.min((내림[위] ?? 0) + 창크기, Math.max(0, (그래프()[위]!.목록?.length ?? 0) - 창크기));
        return 답(null);
      }
      부름.push(`${script} ${args[0]!.appId}`);
      내림 = {};
      if (script === 'mobile: clearApp' && clearApp막힘) return new Response(JSON.stringify({ value: { error: 'unknown error', message: 'not allowed' } }), { status: 500 });
      if (script === 'mobile: clearApp') [로그인됨, 입력] = [false, {}];
      쌓임 = script === 'mobile: activateApp' ? ['A'] : [];
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
  vi.unstubAllEnvs();
});

const 읽기 = <T>(이름: string): T => JSON.parse(readFileSync(join('.appium-cli/crawl', 이름), 'utf8')) as T;
const 결과 = (): 크롤결과 => 읽기<크롤결과>('index.json');

describe('crawl', () => {
  it('화면 셋을 키 · 이름 · 경로로 남기고 화면 연결을 버튼 이름으로 잇는다', async () => {
    const out = await run(['-s=c', 'crawl'], env);

    expect(out).toMatch(
      /^크롤: 로그아웃 3장 · 목록 3장 · 연결 3개 · API 4개 · 누름 6번 · 재시작 1번 · 지름길 1번\(못 닿음 0\) · 확인 창 0번 · 저장본 없음 · 멈춘 까닭 다 봄 · [\d.]+초 · \.appium-cli\/crawl\/list\.json\n- Snapshot: /,
    );
    const r = 결과();
    expect(r.app).toBe('com.shop');
    expect(r.stopped).toBeNull();
    expect(r.screens.map((s) => [s.key, s.name, s.path])).toEqual([
      ['app:.Main/a screen', 'Home', []],
      ['app:.Main/b screen', 'Bee', ['to b']],
      ['app:.Main/com.shop:id/c_root', 'Sea', ['To C']],
    ]);
    expect(r.links).toEqual([
      { 상태: '로그아웃', from: 'app:.Main/a screen', to: 'app:.Main/b screen', via: '버튼 「to b」' },
      { 상태: '로그아웃', from: 'app:.Main/a screen', to: 'app:.Main/com.shop:id/c_root', via: '버튼 「To C」' },
      { 상태: '로그아웃', from: 'app:.Main/b screen', to: 'app:.Main/com.shop:id/c_root', via: '버튼 「to c」' },
    ]);
  });

  it('back 으로 돌아오고, 못 돌아오면 아는 연결로 가거나 앱을 다시 띄워 경로를 다시 누르고, 다른 앱이면 back 하고, 같은 후보는 두 번 누르지 않는다', async () => {
    await run(['-s=c', 'crawl'], env);

    // 'A to b' 둘째는 A 에서 B 로 가는 지름길이다. 화면 안에서 그대로인 누르기(same · c ok) 뒤에는 back 하지 않는다
    expect(눌림).toEqual(['A to b', 'A To C', 'A open web', 'A com.shop:id/same', 'A to b', 'B to c', 'C c ok']);
    expect(부름).toEqual([
      'back', // B → A
      'back', // C 에서 안 먹는다
      'back', // C 에서 나가는 연결이 없어 back 한 번 — 또 안 먹는다
      'mobile: terminateApp com.shop',
      'mobile: activateApp com.shop', // 그래서 A 로 다시 띄운다 (경로 없음)
      'back', // 다른 앱 → A
      'back', // C 에서 안 먹는다 — 다음 차례가 C 라 그대로 둔다
    ]);
    expect([결과().restarts, 결과().지름길]).toEqual([1, { 닿음: 1, 못닿음: 0 }]);
  });

  it('--max 장에 닿으면 멈춘다', async () => {
    const out = await run(['-s=c', 'crawl', '--max', '2'], env);

    expect(out).toContain('멈춘 까닭 --max 2장');
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

  it('확인 뒤 이어 뜬 창(버튼 칸이 빈 제목만의 창)도 닫고 화면으로 남기지 않는다', async () => {
    화면들 = {
      A: { 틀: { desc: 'a screen' }, 제목: 'Home', 버튼: [{ desc: 'reset' }], 길: { reset: 'R1' } },
      R1: { ...창('Reset app state?'), 길: { 'android:id/button1': '>R2', 'android:id/button2': '<' } },
      R2: { 틀: {}, 제목: '', 버튼: [{ cls: 'TextView', id: 'android:id/alertTitle', text: 'App State has been reset.' }], 길: {} },
    };

    await run(['-s=c', 'crawl'], env);

    expect(결과().dialogs).toEqual({ 누름: 1, 남음: 1 });
    expect(결과().screens.map((s) => s.key)).toEqual(['app:.Main/a screen']);
  });

  it('하나뿐인 선택자인데 못 찾으면(Compose testTag id) 좌표로 누른다', async () => {
    화면들 = {
      A: { 틀: { desc: 'a screen' }, 제목: 'Home', 버튼: [{ id: 'go_d' }], 길: { go_d: 'D' } },
      D: { 틀: { desc: 'd screen' }, 제목: 'Dee', 버튼: [], 길: {} },
    };
    const 기본 = fetchMock.getMockImplementation()!;
    // UiAutomator2 는 꾸러미 없는 id 에 꾸러미를 붙여 찾아 못 찾는다
    fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
      url.endsWith('/element') ? new Response(JSON.stringify({ value: { error: 'no such element', message: 'none' } }), { status: 404 }) : 기본(url, init),
    );

    await run(['-s=c', 'crawl'], env);

    // 둘째는 D 로 가는 경로 다시 누르기다
    expect(눌림).toEqual(['A go_d', 'A go_d']);
    expect((fetchMock.mock.calls as [string][]).filter(([u]) => u.endsWith('/actions'))).toHaveLength(2);
    expect(결과().screens.map((s) => s.key)).toEqual(['app:.Main/a screen', 'app:.Main/d screen']);
  });

  const 줄들 = (n: number): 버튼[] => Array.from({ length: n }, (_, k) => ({ desc: `r${k + 1}` }));

  it('후보를 다 누른 뒤 목록을 위로 밀어 새 후보를 누르고, 새 후보가 없으면 그만 민다 — 밀어도 화면 키는 그대로다', async () => {
    화면들 = {
      A: { 틀: { desc: 'a screen' }, 제목: 'Home', 버튼: [{ desc: 'top' }], 길: { r6: 'R' }, 목록: 줄들(7) },
      R: { 틀: { desc: 'r screen' }, 제목: 'Row', 버튼: [], 길: {} },
    };

    await run(['-s=c', 'crawl'], env);

    // r4 ~ r6 은 한 번, r7 은 두 번 민 뒤에 보인다. 마지막 'A r6' 은 R 로 가는 지름길 — 목록 끝(r5 ~ r7)에 이미 보여 안 민다
    expect(눌림).toEqual(['A top', 'A r1', 'A r2', 'A r3', 'A r4', 'A r5', 'A r6', 'A r7', 'A r6']);
    expect(부름).toEqual([
      'swipe up', // r4 ~ r6
      'back', // R → A (목록 자리는 남는다)
      'swipe up', // r7
      'swipe up', // 끝 — 새 후보 없음
    ]);
    expect(결과().screens.map((s) => [s.key, s.path])).toEqual([
      ['app:.Main/a screen', []],
      ['app:.Main/r screen', ['↓1', 'r6']],
    ]);
    // 스크롤 요소 자리에서 민다
    const 민몸 = (fetchMock.mock.calls as [string, RequestInit][]).find(([, i]) => String(i.body).includes('swipeGesture'))![1].body;
    expect(JSON.parse(String(민몸))).toEqual({ script: 'mobile: swipeGesture', args: [{ left: 0, top: 200, width: 1080, height: 1790, direction: 'up', percent: 0.75 }] });
  });

  it('back 뒤 목록이 처음으로 가는 앱이면 다시 밀어 누르고, 스크롤 뒤 화면 · 그 밑 화면은 아는 연결(↓ 포함)로 간다', async () => {
    돌아옴자리버림 = true;
    화면들 = {
      A: { 틀: { desc: 'a screen' }, 제목: 'Home', 버튼: [], 길: { r4: 'S' }, 목록: 줄들(6) },
      S: { 틀: { desc: 's screen' }, 제목: 'Ess', 버튼: [{ desc: 'to t' }], 길: { 'to t': 'T' } },
      T: { 틀: { desc: 't screen' }, 제목: 'Tee', 버튼: [], 길: {} },
    };

    await run(['-s=c', 'crawl'], env);

    expect(눌림).toEqual(['A r1', 'A r2', 'A r3', 'A r4', 'A r5', 'A r6', 'A r4', 'S to t', 'S to t']);
    expect(부름).toEqual([
      'swipe up', // r4 ~ r6
      'back', // S → A, 목록이 처음으로
      'swipe up', // r5 를 찾아 다시 민다 — 재시작 없이
      'swipe up', // 끝 — r4 ~ r6 이 보인 채라 S 로 가는 ↓1 은 안 민다
      'back', // T → S — T 로는 S 에서 'to t' 하나
    ]);
    expect(결과().screens.map((s) => [s.key, s.path])).toEqual([
      ['app:.Main/a screen', []],
      ['app:.Main/s screen', ['↓1', 'r4']],
      ['app:.Main/t screen', ['↓1', 'r4', 'to t']],
    ]);
    expect([결과().restarts, 결과().지름길]).toEqual([0, { 닿음: 2, 못닿음: 0 }]);
  });

  it('back 이 서랍이 아니라 바탕 화면으로 가도 바탕에서 아는 연결로 서랍 · 서랍 항목 화면에 간다 — 재시작 없이', async () => {
    // 서랍 항목은 서랍을 닫으며 간다('>') — back 하면 서랍이 아니라 A (MDA 서랍 2026-10-20 실측)
    화면들 = {
      A: { 틀: { desc: 'a screen' }, 제목: 'Home', 버튼: [{ desc: 'open menu' }], 길: { 'open menu': 'M' } },
      M: { 틀: { desc: 'menu' }, 제목: 'Menu', 버튼: [{ desc: 'item x' }, { desc: 'item y' }], 길: { 'item x': '>E', 'item y': '>F' } },
      E: { 틀: { desc: 'x screen' }, 제목: 'Ex', 버튼: [], 길: {} },
      F: { 틀: { desc: 'y screen' }, 제목: 'Why', 버튼: [], 길: {} },
    };

    await run(['-s=c', 'crawl'], env);

    expect(눌림).toEqual([
      'A open menu',
      'A open menu', // M 으로 (지름길)
      'M item x',
      'A open menu', // back 이 A 로 가서 M 으로 다시 (지름길)
      'M item y',
      'A open menu', // X 로: A → M → X
      'M item x',
      'A open menu', // Y 로: X 에서 나가는 연결이 없어 back 한 번 → A → M → Y
      'M item y',
    ]);
    expect(부름).toEqual(['back', 'back', 'back', 'back']);
    expect(결과().screens.map((s) => [s.key, s.path])).toEqual([
      ['app:.Main/a screen', []],
      ['app:.Main/menu', ['open menu']],
      ['app:.Main/x screen', ['open menu', 'item x']],
      ['app:.Main/y screen', ['open menu', 'item y']],
    ]);
    expect([결과().restarts, 결과().지름길]).toEqual([0, { 닿음: 4, 못닿음: 0 }]);
  });

  it('back 이 조상 화면으로 가면 그 뒤 경로만 누른다', async () => {
    // K 의 'to d' 는 K 를 닫으며 간다 — D 에서 back 하면 B
    화면들 = {
      A: { 틀: { desc: 'a screen' }, 제목: 'Home', 버튼: [{ desc: 'to b' }], 길: { 'to b': 'B' } },
      B: { 틀: { desc: 'b screen' }, 제목: 'Bee', 버튼: [{ desc: 'to c' }], 길: { 'to c': 'K' } },
      K: { 틀: { desc: 'c screen' }, 제목: 'Sea', 버튼: [{ desc: 'to d' }], 길: { 'to d': '>D' } },
      D: { 틀: { desc: 'd screen' }, 제목: 'Dee', 버튼: [{ desc: 'd ok' }], 길: {} },
    };

    await run(['-s=c', 'crawl'], env);

    expect(결과().screens.at(-1)!.path).toEqual(['to b', 'to c', 'to d']);
    // D 의 'd ok' 앞 'B to c' · 'C to d' — D 의 path 에서 조상 B 뒤 걸음만
    expect(눌림).toEqual(['A to b', 'A to b', 'B to c', 'B to c', 'K to d', 'B to c', 'K to d', 'D d ok']);
    expect(부름.filter((x) => x.startsWith('mobile:'))).toEqual([]);
    expect([결과().restarts, 결과().지름길]).toEqual([0, { 닿음: 3, 못닿음: 0 }]);
  });

  it('지름길 걸음이 어긋나면(목록이 지나 내려가 있다) 앱을 다시 띄워 경로(↓ 포함)로 간다', async () => {
    화면들 = {
      A: { 틀: { desc: 'a screen' }, 제목: 'Home', 버튼: [], 길: { r4: 'S' }, 목록: 줄들(9) },
      S: { 틀: { desc: 's screen' }, 제목: 'Ess', 버튼: [], 길: {} },
    };

    await run(['-s=c', 'crawl'], env);

    // 목록 끝(r7 ~ r9)에서 S 로 — r4 가 위라 위로 밀어도 안 보인다 → 다시 띄워 ↓1 · r4
    expect(눌림.slice(-2)).toEqual(['A r9', 'A r4']);
    expect(부름.slice(-5)).toEqual(['swipe up', 'swipe up', 'mobile: terminateApp com.shop', 'mobile: activateApp com.shop', 'swipe up']);
    expect(결과().screens.map((s) => [s.key, s.path])).toEqual([
      ['app:.Main/a screen', []],
      ['app:.Main/s screen', ['↓1', 'r4']],
    ]);
    expect([결과().restarts, 결과().지름길]).toEqual([1, { 닿음: 0, 못닿음: 1 }]);
  });

  it.each([
    [3, 5, 18], // 화면당 다섯 번까지만 민다
    [8, 3, 30], // 화면당 누름 30 번을 넘기지 않는다
  ])('보이는 줄 %i 개 — %i 번 밀고 %i 개를 누른다', async (보이는줄, 민수, 누른수) => {
    창크기 = 보이는줄;
    화면들 = { A: { 틀: { desc: 'a screen' }, 제목: 'Home', 버튼: [], 길: {}, 목록: 줄들(60) } };

    await run(['-s=c', 'crawl'], env);

    expect(부름.filter((x) => x === 'swipe up')).toHaveLength(민수);
    expect(눌림).toEqual(줄들(누른수).map((b) => `A ${b.desc}`));
    expect(결과().screens.map((s) => s.key)).toEqual(['app:.Main/a screen']);
  });

  it('--max 는 1 ~ 100 장만 받는다', async () => {
    fetchMock.mockClear();
    await expect(run(['-s=c', 'crawl', '--max', '101'], env)).rejects.toThrow('--max 는 1 ~ 100 장이다');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('crawl 결과 파일', () => {
  interface 목록줄 { 주소: string; 이름: string; 상태: string; 파일: string; 틀: string; 지문: string; 글자지문: string; 저장본?: string; 저장기록?: string }
  const A = 'app:.Main/a screen';
  const B = 'app:.Main/b screen';
  const C = 'app:.Main/com.shop:id/c_root';

  it('test_platform 크롤러 칸 이름으로 화면 파일 · list · links · apis · summary 를 낸다', async () => {
    await run(['-s=c', 'crawl'], env);

    const 목록 = 읽기<목록줄[]>('list.json');
    expect(목록.map((x) => [x.주소, x.틀, x.이름, x.상태, x.파일])).toEqual([
      [A, A, 'Home', '로그아웃', '로그아웃/001.yml'],
      [B, B, 'Bee', '로그아웃', '로그아웃/002.yml'],
      [C, C, 'Sea', '로그아웃', '로그아웃/003.yml'],
    ]);
    // test_platform 화면검사 — 16진 64자 이하
    for (const x of 목록) expect([x.지문, x.글자지문]).toEqual([expect.stringMatching(/^[0-9a-f]{1,64}$/), expect.stringMatching(/^[0-9a-f]{1,64}$/)]);
    expect(Object.keys(목록[0]!).sort()).toEqual(['글자지문', '상태', '이름', '주소', '지문', '틀', '파일']);
    expect(readFileSync('.appium-cli/crawl/로그아웃/002.yml', 'utf8')).toMatch(/^# app:\.Main\/b screen\n화면 1080x2400 · 요소 \d+개\n.*desc="to c"/s);
    expect(읽기('links.json')).toEqual([
      { 상태: '로그아웃', 틀: A, 연결: [{ to: B, via: '버튼 「to b」' }, { to: C, via: '버튼 「To C」' }] },
      { 상태: '로그아웃', 틀: B, 연결: [{ to: C, via: '버튼 「to c」' }] },
    ]);
    expect(읽기('summary.json')).toEqual({ 멈춘까닭: null, 상태들: ['로그아웃'], 예외: false });
    expect(결과().screens[0]).toMatchObject({ 상태: '로그아웃', 파일: '로그아웃/001.yml', textFp: 목록[0]!.글자지문 });
    expect(결과().screens[0]).not.toHaveProperty('record');
  });

  it('시작 때 쌓인 logcat 은 버리고, 누른 뒤 API 는 간 화면 몫 · 안 바뀌었거나 다른 앱이면 누른 화면 몫이다', async () => {
    await run(['-s=c', 'crawl'], env);

    const api = (u: string): { method: string; url: string } => ({ method: 'GET', url: `https://api.shop/${u}` });
    expect(읽기('apis.json')).toEqual([
      { 상태: '로그아웃', 틀: A, api: [api('web'), api('same-tap')] },
      { 상태: '로그아웃', 틀: B, api: [api('b-load')] }, // 경로 다시 누르기의 b-load 는 겹쳐 하나
      { 상태: '로그아웃', 틀: C, api: [api('c-load')] },
    ]);
  });

  it('--api-pattern 을 crawl 에도 쓴다', async () => {
    const out = await run(['-s=c', 'crawl', '--api-pattern', '/(POST) (\\S+)/'], env);

    expect(out).toContain('API 0개');
  });

  it('--keep 저장본과 견줘 같음 · 바뀜 · 새 화면 · 못 본 화면을 list.json 과 요약 줄에 낸다', async () => {
    await run(['-s=c', 'crawl'], env);
    const 앞 = 읽기<목록줄[]>('list.json');
    const 항목 = (x: 목록줄, 글자지문: string, 기록: string): Record<string, string> => ({
      키: `로그아웃 ${x.틀}`, 상태: '로그아웃', 틀: x.틀, 주소: x.주소, 지문: x.지문, 글자지문, 기록, 훑은날: new Date().toISOString().slice(0, 10),
    });
    writeFileSync(
      'kept.json',
      JSON.stringify({
        판: 1,
        항목: [
          항목(앞[0]!, 앞[0]!.글자지문, 'out-aaaaaaaaaaaa.md'),
          항목(앞[1]!, '000000000000', 'out-bbbbbbbbbbbb.md'),
          항목({ ...앞[1]!, 주소: 'app:.Main/gone', 틀: 'app:.Main/gone' }, '111111111111', 'out-cccccccccccc.md'),
        ],
      }),
    );
    쌓임 = ['A'];

    const out = await run(['-s=c', 'crawl', '--keep', 'kept.json', '--out', 'out'], env);

    expect(out).toContain('저장본 같음 1 · 바뀜 1 · 새 화면 1 · 저장본에 있는데 못 본 화면 1');
    expect(out).toContain('· out/list.json');
    const 목록 = JSON.parse(readFileSync('out/list.json', 'utf8')) as 목록줄[];
    expect(목록.map((x) => [x.틀, x.저장본, x.저장기록])).toEqual([
      [A, '같음', 'out-aaaaaaaaaaaa.md'],
      [B, '바뀜', undefined],
      [C, '새 화면', undefined],
    ]);
  });

  it('도중에 Appium 이 죽어도 본 것까지는 남기고 summary 에 예외로 적는다', async () => {
    const 기본처리 = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
      url.endsWith('/back') ? new Response(JSON.stringify({ value: { error: 'invalid session id', message: 'gone' } }), { status: 404 }) : 기본처리(url, init),
    );

    await expect(run(['-s=c', 'crawl'], env)).rejects.toThrow(/^크롤이 도중에 멈췄다 — Appium 이 HTTP 404 로 답했다: gone.*\.appium-cli\/crawl\/list\.json 에 남겼다$/);
    expect(읽기('summary.json')).toEqual({ 멈춘까닭: null, 상태들: [], 예외: true });
    expect(읽기<목록줄[]>('list.json').map((x) => x.틀)).toEqual([A, B]);
  });
});

describe('crawl --out 정리', () => {
  // 크롤이 쓰는 것 몇 개 + 남의 파일 — 거절이면 하나도 안 지워져야 한다
  const 심는다 = (곳: string): void => {
    mkdirSync(join(곳, '로그아웃'), { recursive: true });
    writeFileSync(join(곳, '로그아웃/099.yml'), '# 지난 화면');
    writeFileSync(join(곳, 'list.json'), '[]');
    writeFileSync(join(곳, 'note.txt'), '내 파일');
  };
  const 남았다 = (곳: string): boolean[] => ['로그아웃/099.yml', 'list.json', 'note.txt'].map((x) => existsSync(join(곳, x)));

  it('시작할 때 지난 상태 폴더 · 결과 json 만 지우고 폴더의 다른 파일은 둔다', async () => {
    심는다('.appium-cli/crawl');
    mkdirSync('.appium-cli/crawl/로그인');
    writeFileSync('.appium-cli/crawl/로그인/050.yml', '# 지난 로그인 화면');
    writeFileSync('.appium-cli/crawl/apis.json', '"old"');

    await run(['-s=c', 'crawl'], env);

    expect(남았다('.appium-cli/crawl')).toEqual([false, true, true]);
    expect(existsSync('.appium-cli/crawl/로그인')).toBe(false);
    expect(readFileSync('.appium-cli/crawl/note.txt', 'utf8')).toBe('내 파일');
    expect(읽기<unknown[]>('list.json')).toHaveLength(3);
    expect(읽기<unknown[]>('apis.json')).toHaveLength(3);
  });

  it('뿌리 · 홈 · 작업 폴더 · 그 위 폴더는 아무것도 안 지우고 Appium 도 안 부르고 거절한다', async () => {
    const 집 = mkdtempSync(join(tmpdir(), 'appium-cli-home-'));
    vi.stubEnv('HOME', 집);
    심는다(집);
    심는다('.');
    // 위 폴더를 보려고 한 칸 내려가 session 파일을 옮겨 둔다 — '..' 은 이 테스트 폴더다
    mkdirSync('w');
    cpSync('.appium-cli', 'w/.appium-cli', { recursive: true });
    process.chdir('w');
    fetchMock.mockClear();

    for (const out of ['/', 집, '.', resolve('.'), '..', resolve('../..')]) {
      await expect(run(['-s=c', 'crawl', '--out', out], env)).rejects.toThrow(`--out 이 뿌리 · 홈 · 작업 폴더나 그 위 폴더다 — 그 아래 폴더를 준다: ${out}`);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(남았다(집)).toEqual([true, true, true]);
    expect(남았다('..')).toEqual([true, true, true]);
  });

  it('상태 폴더가 symlink 면 따라가지 않고 아무것도 안 지우고 거절한다', async () => {
    mkdirSync('elsewhere');
    writeFileSync('elsewhere/001.yml', '남의 것');
    mkdirSync('out');
    writeFileSync('out/list.json', '[]');
    symlinkSync(resolve('elsewhere'), 'out/로그인');
    fetchMock.mockClear();

    await expect(run(['-s=c', 'crawl', '--out', 'out'], env)).rejects.toThrow('--out 의 로그인 폴더가 symlink 다 — 따라가 지우지 않는다: out/로그인');
    expect(fetchMock).not.toHaveBeenCalled();
    expect([existsSync('elsewhere/001.yml'), existsSync('out/로그인'), existsSync('out/list.json')]).toEqual([true, true, true]);
  });
});

describe('crawl --login', () => {
  const 스크립트 = "# 로그인 — appium-cli 명령 한 줄씩\ntap '~to menu'\ntap \"~log in\"\n\nfill ~user bob\nfill ~pass secret\ntap '~login button'\n";
  const 키 = (x: string): string => `app:.Main/${x}`;
  const 로그인판 = '로그인:일반 회원';
  beforeEach(() => {
    [화면들, 안화면들] = [밖, 안];
    writeFileSync('login.txt', 스크립트);
  });

  it('로그아웃 판 뒤 앱을 비우고 로그인해 로그인 판을 돌고, 로그인 화면이 뜨면 다시 로그인해 한 번 더 누르고, 로그아웃은 다시 로그인할 수 있을 때만 누른다', async () => {
    const out = await run(['-s=c', 'crawl', '--login', 'login.txt', '--max', '40'], env);

    expect(out).toMatch(/^크롤: 로그아웃 5장 · 로그인:일반 회원 7장 · 목록 8장 · .* · 다시 로그인 2번\(앱 비우기 mobile: clearApp\) · 저장본 없음 · 멈춘 까닭 다 봄 · /);
    const r = 결과();
    expect(r.screens.map((s) => [s.상태, s.key, s.로그인풀림 ?? false])).toEqual([
      ['로그아웃', 키('home'), false],
      ['로그아웃', 키('menu'), false],
      ['로그아웃', 키('cart'), false],
      ['로그아웃', 키('login screen'), true], // 로그아웃 판에서는 표시만 — 돌기도 한다
      ['로그아웃', 키('about'), false],
      [로그인판, 키('home'), false],
      [로그인판, 키('menu'), false],
      [로그인판, 키('cart'), false],
      [로그인판, 키('profile'), false],
      [로그인판, 키('login screen'), true], // 다시 로그인한 뒤에도 로그인 화면 — 로그인 칸이 있는 화면으로 남기고 안 돈다
      [로그인판, 키('about'), false],
      [로그인판, 키('checkout'), false],
    ]);
    expect(r.다시로그인).toBe(2); // 'log in' 로그인 화면 한 번 · 로그아웃 한 번
    expect(부름.filter((x) => x === 'mobile: clearApp com.shop')).toHaveLength(3); // 처음 로그인 + 다시 로그인 둘
    expect(눌림.filter((x) => x === 'M menu item log out')).toHaveLength(1); // 로그아웃 판에서는 안 누른다
    expect(읽기('summary.json')).toEqual({ 멈춘까닭: null, 상태들: ['로그아웃', 로그인판], 예외: false });
  });

  it('두 판을 한 폴더에 번호를 이어 쓰고, 목록은 로그인 판에도 있는 로그아웃 화면 · 로그인 판 로그인 화면을 빼고, 빠진 화면의 연결은 로그인 화면에 합친다', async () => {
    await run(['-s=c', 'crawl', '--login', 'login.txt', '--max', '40'], env);

    const 목록 = 읽기<{ 상태: string; 틀: string; 파일: string }[]>('list.json');
    expect(목록.map((x) => [x.상태, x.틀, x.파일])).toEqual([
      ['로그아웃', 키('home'), '로그아웃/001.yml'], // 시작 화면은 둘 다
      ['로그아웃', 키('login screen'), '로그아웃/004.yml'],
      [로그인판, 키('home'), '로그인/006.yml'],
      [로그인판, 키('menu'), '로그인/007.yml'],
      [로그인판, 키('cart'), '로그인/008.yml'],
      [로그인판, 키('profile'), '로그인/009.yml'],
      [로그인판, 키('about'), '로그인/011.yml'],
      [로그인판, 키('checkout'), '로그인/012.yml'],
    ]);
    expect(readFileSync('.appium-cli/crawl/로그인/010.yml', 'utf8')).toMatch(/^# app:\.Main\/login screen\n# 입력칸: text user\n# 입력칸: password pass\n/);
    const 연결 = (to: string, 버튼: string): { to: string; via: string } => ({ to: 키(to), via: `버튼 「${버튼}」` });
    expect(읽기('links.json')).toEqual([
      { 상태: '로그아웃', 틀: 키('home'), 연결: [연결('menu', 'to menu'), 연결('cart', 'to cart')] },
      { 상태: 로그인판, 틀: 키('home'), 연결: [연결('menu', 'to menu'), 연결('cart', 'to cart'), 연결('profile', 'profile')] },
      { 상태: 로그인판, 틀: 키('menu'), 연결: [연결('login screen', 'log in'), 연결('about', 'about'), 연결('login screen', 'menu item log out')] },
      { 상태: 로그인판, 틀: 키('cart'), 연결: [연결('login screen', 'checkout'), 연결('checkout', 'checkout')] },
    ]);
    expect(읽기<{ 상태: string; 틀: string }[]>('apis.json').map((x) => `${x.상태} ${x.틀}`)).toEqual(목록.map((x) => `${x.상태} ${x.틀}`));
  });

  it('다시 로그인은 세 번까지 — 다 쓰면 로그아웃은 안 누른다. clearApp 을 막는 팜이면 앱만 끄고 로그인한다', async () => {
    안화면들 = {
      ...안,
      M: {
        틀: { desc: 'menu' },
        제목: 'Menu',
        버튼: [{ desc: 'log out a' }, { desc: 'logout b' }, { desc: 'sign out c' }, { desc: 'log off d' }],
        길: { 'log out a': '로그아웃', 'logout b': '로그아웃', 'sign out c': '로그아웃', 'log off d': '로그아웃' },
      },
    };
    clearApp막힘 = true;

    const out = await run(['-s=c', 'crawl', '--login', 'login.txt', '--max', '40'], env);

    expect(out).toContain('다시 로그인 3번(앱 비우기 mobile: terminateApp)');
    expect(결과().다시로그인).toBe(3);
    expect(눌림.filter((x) => /^M (log ?out|sign out|log off)/.test(x))).toEqual(['M log out a', 'M logout b', 'M sign out c']);
  });

  it('로그인 스크립트 뒤에도 로그인 화면이면 멈추고, 로그아웃 판까지는 남긴다', async () => {
    writeFileSync('login.txt', 스크립트.replace('secret', 'wrong'));

    await expect(run(['-s=c', 'crawl', '--login', 'login.txt'], env)).rejects.toThrow('로그인 스크립트를 돌린 뒤에도 로그인 화면이다');
    expect(읽기('summary.json')).toEqual({ 멈춘까닭: null, 상태들: ['로그아웃'], 예외: true });
  });

  it('스크립트에 fill --submit · hide-keyboard 를 쓸 수 있다', async () => {
    writeFileSync('login.txt', 스크립트.replace('fill ~pass secret', 'fill ~pass secret --submit\nhide-keyboard'));

    await run(['-s=c', 'crawl', '--login', 'login.txt', '--max', '40'], env);

    const 비움 = 부름.indexOf('mobile: clearApp com.shop');
    expect(부름.slice(비움, 비움 + 4)).toEqual(['mobile: clearApp com.shop', 'mobile: activateApp com.shop', 'mobile: performEditorAction done', 'hide-keyboard']);
    expect(읽기('summary.json')).toMatchObject({ 상태들: ['로그아웃', 로그인판], 예외: false });
  });

  it.each([
    ['close\n', '1줄: close 은 못 쓴다'],
    ["# 주석\ntap e3\n", '2줄: ref 대신 선택자'],
    ['# 빈 스크립트\n', '로그인 스크립트가 비었다'],
  ])('스크립트 %j 는 Appium 을 부르기 전에 거절한다', async (글, 말) => {
    writeFileSync('login.txt', 글);
    fetchMock.mockClear();

    await expect(run(['-s=c', 'crawl', '--login', 'login.txt'], env)).rejects.toThrow(말);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('--role 로 판 이름을 바꾸고, 틀린 역할은 거절한다', async () => {
    await expect(run(['-s=c', 'crawl', '--login', 'login.txt', '--role', ' 관리자'], env)).rejects.toThrow('--role 은');

    await run(['-s=c', 'crawl', '--login', 'login.txt', '--role', '관리자'], env);
    expect(읽기('summary.json')).toMatchObject({ 상태들: ['로그아웃', '로그인:관리자'] });
  });
});

describe('screen · screenKey', () => {
  it('screen 명령은 지금 화면 키 · 이름을 한 줄로 내고, crawl 이 남기는 키와 같다', async () => {
    쌓임 = ['A', 'B'];
    expect(await run(['-s=c', 'screen'], env)).toBe('app:.Main/b screen · Bee');

    쌓임 = ['A'];
    await run(['-s=c', 'crawl'], env);
    expect(결과().screens.map((s) => `${s.key} · ${s.name}`)).toContain('app:.Main/b screen · Bee');
  });

  it('이름이 없으면 키만 낸다', async () => {
    화면들 = { A: { 틀: { desc: 'blank' }, 제목: '', 버튼: [], 길: {} } };
    expect(await run(['-s=c', 'screen'], env)).toBe('app:.Main/blank');
  });

  it('내보낸 screenKey 는 crawl 이 남긴 키 · 이름 · 구조 지문과 같다', async () => {
    await run(['-s=c', 'crawl'], env);

    const 남김 = 결과().screens.map(({ key, name, structFp }) => ({ key, name, structFp }));
    const 셈 = (['A', 'B', 'C'] as const).map((k) => screenKey(XML(기본[k]!.틀, 기본[k]!.제목, 기본[k]!.버튼), '.Main'));
    expect(셈).toEqual(남김);
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

  // MDA 서랍 메뉴 실측 꼴 — 메뉴 칸이 products screen 의 형제로 오고 그 자리를 덮는다. 위 머리 버튼은 컨테이너 밖이다
  const 서랍XML = (열림: boolean): string => `<hierarchy width="1080" height="2400">
  <android.widget.FrameLayout resource-id="android:id/content" clickable="false" bounds="[0,75][1080,2265]">
    ${열림 ? '<android.view.ViewGroup content-desc="menu item catalog" clickable="true" bounds="[0,86][756,258]"><android.widget.TextView text="Catalog" clickable="false" bounds="[0,137][266,205]" /></android.view.ViewGroup>' : ''}
    ${열림 ? '<android.view.ViewGroup content-desc="menu item about" clickable="true" bounds="[0,258][756,428]"><android.widget.TextView text="About" clickable="false" bounds="[0,309][292,377]" /></android.view.ViewGroup>' : ''}
    <android.view.ViewGroup content-desc="open menu" clickable="true" bounds="[56,89][169,202]" />
    <android.view.ViewGroup content-desc="products screen" clickable="false" bounds="[0,216][1080,2265]">
      <android.widget.TextView text="Products" clickable="false" bounds="[56,286][345,363]" />
      <android.view.ViewGroup content-desc="store item" clickable="false" bounds="[56,462][512,1183]">
        <android.view.ViewGroup clickable="true" bounds="[56,462][512,993]"><android.widget.TextView text="Backpack" content-desc="store item text" clickable="false" bounds="[56,932][512,993]" /></android.view.ViewGroup>
      </android.view.ViewGroup>
      <android.view.ViewGroup content-desc="store item" clickable="false" bounds="[568,462][1024,1183]">
        <android.view.ViewGroup clickable="true" bounds="[568,462][1024,993]"><android.widget.TextView text="Bike Light" content-desc="store item text" clickable="false" bounds="[568,932][1024,993]" /></android.view.ViewGroup>
      </android.view.ViewGroup>
    </android.view.ViewGroup>
  </android.widget.FrameLayout>
</hierarchy>`;

  it('서랍 메뉴처럼 컨테이너 밑이 아닌 누를 것이 컨테이너 자리를 덮으면 그 덮개가 이름표다 — 뒤 화면과 키가 뭉치지 않는다', () => {
    expect(화면을가린다(parseSource(서랍XML(false)), '.MainActivity')).toMatchObject({ key: 'app:.MainActivity/products screen', name: 'Products' });
    expect(화면을가린다(parseSource(서랍XML(true)), '.MainActivity')).toMatchObject({ key: 'app:.MainActivity/menu item about', name: 'About' }); // catalog 는 가운데가 컨테이너 위다
  });

  it('이름 없는 버튼은 자손의 첫 desc · 글자로 부르고, 같은 이름은 앞 것만 누른다', () => {
    expect(후보들(parseSource(서랍XML(false))).map((x) => x.이름)).toEqual(['open menu', 'store item text']);
  });

  it('목록을 밀어 보이는 줄이 바뀌어도 키는 컨테이너에서 나와 그대로다', () => {
    const 키 = (줄: 버튼[]): string => 화면을가린다(parseSource(XML({ desc: 'list screen' }, 'Shop', [{ desc: 'top' }], 줄)), '.Main').key;

    expect(키([{ desc: 'r1' }, { desc: 'r2' }])).toBe('app:.Main/list screen');
    expect(키([{ desc: 'r5' }, { text: '더 보기', cls: 'TextView' }])).toBe('app:.Main/list screen');
  });

  it('이름표가 없으면 구조 지문 — 글자 · 숫자만 바뀌면 같고 짜임이 바뀌면 다르다', () => {
    const 키 = (제목: string, 버튼들: 버튼[]): string => 화면을가린다(parseSource(XML({}, 제목, 버튼들)), '.Main').key;
    const 처음 = 키('3 items', [{ text: 'Buy 1' }]);

    expect(처음).toMatch(/^app:\.Main\/[0-9a-f]{12}$/);
    expect(키('12 things', [{ text: 'Sell 20' }])).toBe(처음);
    expect(키('3 items', [{ text: 'Buy 1' }, { text: 'Buy 2' }])).not.toBe(처음);
  });
});
