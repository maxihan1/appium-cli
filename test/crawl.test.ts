// crawl 이 화면 셋 그래프를 도는지(새 화면 · 연결 · back · 재시작 + 경로 다시 누르기 · 다른 앱 · 상한) · 안 누를 것 · 확인 창과 화면 키 규칙을 본다

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { 가라앉기 } from '../src/appium.js';
import { run } from '../src/cli.js';
import { type 크롤결과, 화면을가린다 } from '../src/crawl.js';
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
let 로그: string[] = [];

function 누름(i: number): void {
  const 위 = 쌓임.at(-1)!;
  const b = 화면들[위]!.버튼[i]!;
  눌림.push(`${위} ${이름(b)}`);
  if (b.api !== undefined) 로그.push(`10-20 10:07:55.318  4242  4300 I okhttp.OkHttpClient: --> GET https://api.shop/${b.api}?token=t1`);
  const 다음 = 화면들[위]!.길[이름(b)];
  if (다음 === '<') 쌓임.pop();
  else if (다음 !== undefined) 쌓임.push(다음);
}

beforeEach(async () => {
  Object.assign(가라앉기, { 최대_ms: 0, 간격_ms: 0 });
  process.chdir(mkdtempSync(join(tmpdir(), 'appium-cli-')));
  쌓임 = ['A'];
  화면들 = 기본;
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

const 읽기 = <T>(이름: string): T => JSON.parse(readFileSync(join('.appium-cli/crawl', 이름), 'utf8')) as T;
const 결과 = (): 크롤결과 => 읽기<크롤결과>('index.json');

describe('crawl', () => {
  it('화면 셋을 키 · 이름 · 경로로 남기고 화면 연결을 버튼 이름으로 잇는다', async () => {
    const out = await run(['-s=c', 'crawl'], env);

    expect(out).toMatch(
      /^크롤: 로그아웃 3장 · 연결 3개 · API 4개 · 누름 6번 · 재시작 2번 · 확인 창 0번 · 저장본 없음 · 멈춘 까닭 다 봄 · [\d.]+초 · \.appium-cli\/crawl\/list\.json\n- Snapshot: /,
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

  it('이름표가 없으면 구조 지문 — 글자 · 숫자만 바뀌면 같고 짜임이 바뀌면 다르다', () => {
    const 키 = (제목: string, 버튼들: 버튼[]): string => 화면을가린다(parseSource(XML({}, 제목, 버튼들)), '.Main').key;
    const 처음 = 키('3 items', [{ text: 'Buy 1' }]);

    expect(처음).toMatch(/^app:\.Main\/[0-9a-f]{12}$/);
    expect(키('12 things', [{ text: 'Sell 20' }])).toBe(처음);
    expect(키('3 items', [{ text: 'Buy 1' }, { text: 'Buy 2' }])).not.toBe(처음);
  });
});
