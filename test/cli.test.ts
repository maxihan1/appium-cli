// CLI 명령이 Appium 에 보내는 요청 순서 · 출력 · session 파일을 본다. 네트워크는 fetch 가짜로 막는다

import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { 가라앉기 } from '../src/appium.js';
import { run } from '../src/cli.js';
import * as 입구 from '../src/index.js';

import { 화면XML } from './fixture.js';

const fetchMock = vi.fn();
const env = { PLATFORM_APPIUM_URL: 'http://user:pw@farm:4723/wd/hub', PLATFORM_APP: '/apk/dev.apk' };
const 답 = (value: unknown, status = 200): Response => new Response(JSON.stringify({ value }), { status });

// 길마다 답을 정해 두고, 부른 순서를 `METHOD 경로` 로 모은다
function 가짜(): void {
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.startsWith('http://farm:4723/api/devices?')) return 답({ devices: [{ serial: 'R3', model: 'SM-G996N', osVersion: '15', state: 'IDLE', detail: 'ready' }] });
    if (url === 'http://farm:4723/api/devices') return 답({ devices: [{ serial: 'R3', model: 'SM-G996N', osVersion: '15', state: 'OCCUPIED', detail: 'manual' }] });
    if (url.endsWith('/hold') && init.method === 'POST') return new Response(JSON.stringify({ held: { until: 0, now: 0 } }));
    if (url.endsWith('/hold')) return new Response(JSON.stringify({ released: true }));
    const path = url.replace('http://farm:4723/wd/hub', '');
    if (path === '/session') return 답({ sessionId: 's-1', capabilities: {} });
    if (path.endsWith('/source')) return 답(화면XML);
    if (path.endsWith('/element')) return 답({ 'element-6066-11e4-a5ab-c8d2b5b44a87': 'el-9' });
    if (path.endsWith('/screenshot')) return 답(Buffer.from('png').toString('base64'));
    return 답(init.method === 'DELETE' ? null : {});
  });
}
const 부른길 = (): string[] => (fetchMock.mock.calls as [string, RequestInit][]).map(([u, i]) => `${i.method} ${u.replace('http://farm:4723/wd/hub', '')}`);

beforeEach(async () => {
  Object.assign(가라앉기, { 최대_ms: 0, 간격_ms: 0, 찾기_ms: 10_000, 산출물_ms: 0, 산출물간격_ms: 0 });
  process.chdir(mkdtempSync(join(tmpdir(), 'appium-cli-')));
  fetchMock.mockReset();
  가짜();
  vi.stubGlobal('fetch', fetchMock);
  await run(['-s=probe', 'open'], env);
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('open', () => {
  it('kit 과 같은 설정으로 session 을 열고, 계정은 머리로 옮기고, 첫 화면을 찍는다', async () => {
    await run(['-s=probe', 'close'], env);
    fetchMock.mockClear();

    const out = await run(['-s=probe', 'open'], env);

    expect(out).toMatch(/^session probe 열림 \(s-1\)\n- Snapshot: \.appium-cli\/screen-\d+\.txt$/);
    expect(부른길()).toEqual(['POST /session', 'GET /session/s-1/source']);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('user:pw').toString('base64')}`);
    expect(JSON.parse(init.body as string).capabilities.alwaysMatch['appium:app']).toBe('/apk/dev.apk');
  });

  it('토큰이 있으면 URL 안 계정 대신 Bearer 로 보낸다', async () => {
    await run(['-s=probe', 'snapshot'], { ...env, PLATFORM_APPIUM_TOKEN: 'pat_x' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://farm:4723/wd/hub/session/s-1/source');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer pat_x');
  });

  it('--token 이 환경값보다 앞선다', async () => {
    await run(['-s=probe', 'snapshot', '--token', 'pat_cli'], { ...env, PLATFORM_APPIUM_TOKEN: 'pat_env' });

    expect(((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>).Authorization).toBe('Bearer pat_cli');
  });

  it('--filter · --app URL 을 그대로 싣는다', async () => {
    await run(['-s=probe', 'close'], env);
    fetchMock.mockClear();

    await run(['-s=probe', 'open', '--app', 'https://farm/app.apk', '--filter', 'os>=13'], env);

    const caps = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string).capabilities.alwaysMatch;
    expect(caps).toMatchObject({ 'appium:app': 'https://farm/app.apk', 'farm:filter': 'os>=13' });
  });

  it('--cap 은 JSON 이면 JSON 값, 아니면 글 그대로 싣고 첫 = 에서 가르고 기본값을 덮는다', async () => {
    await run(['-s=probe', 'close'], env);
    fetchMock.mockClear();

    await run(
      [
        '-s=probe', 'open',
        '--cap', 'appium:optionalIntentArguments=--es server http://host:3002?a=b',
        '--cap', 'appium:autoGrantPermissions=true',
        '--cap', 'appium:logcatFilterSpecs=["OkHttp:D","*:S"]',
        '--cap', 'appium:newCommandTimeout=600',
        '--cap', 'x:quoted="5"',
      ],
      env,
    );

    const caps = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string).capabilities.alwaysMatch;
    expect(caps).toMatchObject({
      'appium:app': '/apk/dev.apk',
      'appium:optionalIntentArguments': '--es server http://host:3002?a=b',
      'appium:autoGrantPermissions': true,
      'appium:logcatFilterSpecs': ['OkHttp:D', '*:S'],
      'appium:newCommandTimeout': 600,
      'x:quoted': '5',
    });
  });

  it('--cap 키가 비거나 = 가 없으면 Appium 을 부르지 않고 던진다', async () => {
    await run(['-s=probe', 'close'], env);
    fetchMock.mockClear();

    await expect(run(['-s=probe', 'open', '--cap', '=true'], env)).rejects.toThrow('키가 비면 안 된다');
    await expect(run(['-s=probe', 'open', '--cap', 'appium:noReset'], env)).rejects.toThrow('키=값 꼴');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('같은 이름이 열려 있으면 Appium 을 부르지 않고 던진다', async () => {
    await expect(run(['-s=probe', 'open'], env)).rejects.toThrow('이미 열려 있다');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('tap', () => {
  it('desc 가 있으면 accessibility id 로 찾아 누르고, 코드 한 줄과 새 화면을 준다', async () => {
    const out = await run(['-s=probe', 'tap', 'e3'], env);

    expect(부른길()).toEqual(['POST /session/s-1/element', 'POST /session/s-1/element/el-9/click', 'GET /session/s-1/source']);
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({ using: 'accessibility id', value: '로그인 > 시작' });
    expect(out.split('\n')[0]).toBe("Ran: await driver.$('~로그인 > 시작').click()");
  });

  it('주소가 없으면 그 요소 가운데를 누르고 코드는 내지 않는다', async () => {
    const out = await run(['-s=probe', 'tap', 'e2'], env);

    expect(부른길()[0]).toBe('POST /session/s-1/actions');
    expect(out.split('\n')[0]).toBe('Ran: // 주소 없음 — desc 도 id 도 없다. text= 로 찾지 않는다 (좌표 20,30 를 눌렀다)');
  });

  it('ref 대신 선택자(~desc · id=)를 주면 마지막 화면을 안 보고 그 선택자로 찾아 누르고 넣는다', async () => {
    const 누름 = await run(['-s=probe', 'tap', '~Login button'], env);
    const 넣음 = await run(['-s=probe', 'fill', 'id=com.shop:id/pw', 'secret'], env);

    expect(부른길().filter((p) => !p.endsWith('/source'))).toEqual([
      'POST /session/s-1/element',
      'POST /session/s-1/element/el-9/click',
      'POST /session/s-1/element',
      'POST /session/s-1/element/el-9/value',
    ]);
    const 찾음 = (fetchMock.mock.calls as [string, RequestInit][]).filter(([u]) => u.endsWith('/element')).map(([, i]) => JSON.parse(i.body as string));
    expect(찾음).toEqual([{ using: 'accessibility id', value: 'Login button' }, { using: 'id', value: 'com.shop:id/pw' }]);
    expect(누름.split('\n')[0]).toBe("Ran: await driver.$('~Login button').click()");
    expect(넣음.split('\n')[0]).toBe("Ran: await driver.$('id=com.shop:id/pw').setValue('secret')");
  });

  it('선택자로 못 찾으면 찾기_ms 동안 다시 찾고 까닭을 붙여 던진다', async () => {
    가라앉기.찾기_ms = 0;
    const 기본 = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
      url.endsWith('/element') ? 답({ error: 'no such element', message: 'none' }, 404) : 기본(url, init),
    );

    await expect(run(['-s=probe', 'tap', '~없는 버튼'], env)).rejects.toThrow('~없는 버튼 를 지금 화면에서 못 찾았다 — Appium 이 HTTP 404 로 답했다: none');
  });

  it('꾸러미 없는 id(Compose testTag)를 못 찾으면 disableIdLocatorAutocompletion 을 알린다 — 꾸러미 있는 id 는 안 붙인다', async () => {
    가라앉기.찾기_ms = 0;
    const 기본 = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
      url.endsWith('/element') ? 답({ error: 'no such element', message: 'none' }, 404) : 기본(url, init),
    );

    await expect(run(['-s=probe', 'tap', 'id=login_id'], env)).rejects.toThrow('none — 꾸러미 없는 id(Compose testTag)는 open 에 --cap appium:disableIdLocatorAutocompletion=true 가 있어야 찾힌다');
    await expect(run(['-s=probe', 'tap', 'id=com.shop:id/pw'], env)).rejects.toThrow(/none$/);
  });

  it('주소 없는 칸의 fill 은 가운데를 누르고 element/active 가 잡힐 때까지 다시 묻는다', async () => {
    const 기본 = fetchMock.getMockImplementation()!;
    let 물음 = 0;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (!url.endsWith('/element/active')) return 기본(url, init);
      물음++;
      return 물음 < 3 ? 답({ error: 'no such element', message: 'none' }, 404) : 답({ 'element-6066-11e4-a5ab-c8d2b5b44a87': 'el-7' });
    });

    const out = await run(['-s=probe', 'fill', 'e2', 'hi'], env);

    expect(부른길().filter((p) => !p.endsWith('/source'))).toEqual([
      'POST /session/s-1/actions',
      'GET /session/s-1/element/active',
      'GET /session/s-1/element/active',
      'GET /session/s-1/element/active',
      'POST /session/s-1/element/el-7/value',
    ]);
    expect(out.split('\n')[0]).toBe('Ran: // 주소 없음 — desc 도 id 도 없다. text= 로 찾지 않는다 (좌표 20,30 칸에 넣었다)');
  });

  it('마지막 화면에 없는 ref 는 Appium 을 부르지 않고 던진다', async () => {
    await expect(run(['-s=probe', 'tap', 'e99'], env)).rejects.toThrow('ref e99 가 마지막 화면에 없다');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('액션 뒤 화면', () => {
  it('화면이 늦게 바뀌면 바뀌고 가라앉을 때까지 다시 읽는다', async () => {
    Object.assign(가라앉기, { 최대_ms: 1000, 간격_ms: 1 });
    const 새화면 = 화면XML.replace('로그인 > 시작', '상품 목록');
    const 차례 = [화면XML, 화면XML, 새화면, 새화면];
    const 기본 = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => (url.endsWith('/source') ? 답(차례.shift() ?? 새화면) : 기본(url, init)));

    const out = await run(['-s=probe', 'tap', 'e3'], env);

    expect(부른길().filter((p) => p.endsWith('/source'))).toHaveLength(4);
    const 파일 = out.split('- Snapshot: ')[1]!;
    expect(await import('node:fs/promises').then((f) => f.readFile(파일, 'utf8'))).toContain('desc="상품 목록"');
  });
});

describe('그 밖의 명령', () => {
  it('fill 은 요소에 값을 보내고 setValue 코드를 준다', async () => {
    const out = await run(['-s=probe', 'fill', 'e4', "a'b"], env);

    expect(부른길().slice(0, 2)).toEqual(['POST /session/s-1/element', 'POST /session/s-1/element/el-9/value']);
    expect(out.split('\n')[0]).toBe("Ran: await driver.$('id=com.shop:id/pw').setValue('a\\'b')");
  });

  it('fill --submit 은 값을 넣은 뒤 performEditorAction done 을 보내고 Ran 줄을 하나 더 준다', async () => {
    const out = await run(['-s=probe', 'fill', 'e4', 'pw', '--submit'], env);

    expect(부른길().slice(0, 3)).toEqual(['POST /session/s-1/element', 'POST /session/s-1/element/el-9/value', 'POST /session/s-1/execute/sync']);
    expect(JSON.parse((fetchMock.mock.calls[2] as [string, RequestInit])[1].body as string)).toEqual({ script: 'mobile: performEditorAction', args: [{ action: 'done' }] });
    expect(out.split('\n').slice(0, 2)).toEqual([
      "Ran: await driver.$('id=com.shop:id/pw').setValue('pw')",
      "Ran: await driver.execute('mobile: performEditorAction', { action: 'done' })",
    ]);
    expect(out.split('\n')[2]).toMatch(/^- Snapshot: /);
  });

  it('hide-keyboard 는 hide_keyboard 를 부르고 hideKeyboard 코드와 새 화면을 준다', async () => {
    const out = await run(['-s=probe', 'hide-keyboard'], env);

    expect(부른길()).toEqual(['POST /session/s-1/appium/device/hide_keyboard', 'GET /session/s-1/source']);
    expect(out.split('\n')[0]).toBe('Ran: await driver.hideKeyboard()');
  });

  it('generate-locator 는 Appium 을 부르지 않고 선택자를 준다', async () => {
    expect(await run(['-s=probe', 'generate-locator', 'e4'], env)).toBe("driver.$('id=com.shop:id/pw')");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('attrs 는 Appium 을 부르지 않고 원래 속성을 한 줄에 하나 — 비밀번호 칸 text 는 안 낸다', async () => {
    expect((await run(['-s=probe', 'attrs', 'e4'], env)).split('\n')).toEqual([
      'resource-id=com.shop:id/pw',
      'content-desc=',
      'bounds=[10,80][30,90]',
      'clickable=true',
      'index=2',
      'password=true',
      'scrollable=false',
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('attrs 는 class · resource-id · content-desc · text · hint 다음 알파벳 차례, 줄바꿈은 \\n', async () => {
    const 입력칸 =
      '<hierarchy width="1080" height="2400"><android.widget.EditText index="0" text="첫&#10;둘" hint="이메일" focusable="true" ' +
      'class="android.widget.EditText" bounds="[0,0][10,10]" content-desc="" resource-id="com.shop:id/email" /></hierarchy>';
    const 기본 = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => (url.endsWith('/source') ? 답(입력칸) : 기본(url, init)));
    await run(['-s=probe', 'snapshot'], env);

    expect((await run(['-s=probe', 'attrs', 'e1'], env)).split('\n')).toEqual([
      'class=android.widget.EditText',
      'resource-id=com.shop:id/email',
      'content-desc=',
      'text=첫\\n둘',
      'hint=이메일',
      'bounds=[0,0][10,10]',
      'focusable=true',
      'index=0',
    ]);
  });

  it('attrs 도 마지막 화면에 없는 ref 는 generate-locator 와 같이 던진다', async () => {
    await expect(run(['-s=probe', 'attrs', 'e99'], env)).rejects.toThrow('ref e99 가 마지막 화면에 없다 — snapshot 을 다시 찍고 거기 ref 를 쓴다');
    await expect(run(['-s=probe', 'attrs'], env)).rejects.toThrow('ref (없음) 가 마지막 화면에 없다');
  });

  it('find 는 마지막 화면에서 줄을 찾는다', async () => {
    expect(await run(['-s=probe', 'find', '--regex', '로그인|Jerry'], env)).toBe(
      'TextView text="Tom & Jerry > 1" [10,20][30,40] [ref=e2]\nButton desc="로그인 > 시작" 클릭 꺼짐 [10,50][30,70] [ref=e3]',
    );
  });

  it('find --regex 에 g 를 붙여도 줄을 건너뛰지 않는다', async () => {
    expect((await run(['-s=probe', 'find', '--regex', '/^ /g'], env)).split('\n')).toHaveLength(3);
  });

  it('attrs — 속성 없이 찍힌 옛 session 파일이면 snapshot 을 다시 찍으라고 한다', async () => {
    const 파일 = '.appium-cli/probe.json';
    const 세션 = JSON.parse(readFileSync(파일, 'utf8')) as { refs: Record<string, { 속성?: unknown }> };
    for (const el of Object.values(세션.refs)) delete el.속성;
    writeFileSync(파일, JSON.stringify(세션));

    await expect(run(['-s=probe', 'attrs', 'e3'], env)).rejects.toThrow('snapshot 을 다시 찍고');
  });

  it('find --regex 는 /식/i 꼴로 플래그를 받는다', async () => {
    expect(await run(['-s=probe', 'find', '--regex', '/jerry/i'], env)).toBe('TextView text="Tom & Jerry > 1" [10,20][30,40] [ref=e2]');
  });

  it('swipe 는 화면 크기로 swipeGesture 를 부른다', async () => {
    const out = await run(['-s=probe', 'swipe', 'up'], env);

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.args[0]).toMatchObject({ left: 108, top: 480, width: 864, height: 1440, direction: 'up' });
    expect(out.split('\n')[0]).toBe("Ran: await driver.swipe({ direction: 'up' })");
  });

  it('close 는 session 을 지우고 파일도 지운다', async () => {
    expect(await run(['-s=probe', 'close'], env)).toBe('session probe 닫힘');
    expect(부른길()).toEqual(['DELETE /session/s-1']);
    expect(existsSync('.appium-cli/probe.json')).toBe(false);
  });

  it('끊긴 session 이면 까닭에 다시 열라는 말을 붙인다', async () => {
    fetchMock.mockResolvedValueOnce(답({ error: 'invalid session id', message: 'gone' }, 404));

    await expect(run(['-s=probe', 'back'], env)).rejects.toThrow('HTTP 404 로 답했다: gone — session 이 끝났다. open 부터 다시 한다');
  });
});

describe('디바이스 팜', () => {
  const 주소들 = (): string[] => (fetchMock.mock.calls as [string, RequestInit][]).map(([u, i]) => `${i.method} ${u}`);

  it('devices 는 /wd/hub 를 뗀 팜 주소에서 폰과 상태를 보인다', async () => {
    expect(await run(['devices'], env)).toBe('R3 SM-G996N Android 15 OCCUPIED(manual)');
    expect(주소들()).toEqual(['GET http://farm:4723/api/devices']);
  });

  it('hold 는 udid 가 없으면 빈 폰 하나를 골라 30분 잡고, release 는 그 폰을 놓는다', async () => {
    expect(await run(['hold'], env)).toMatch(/^폰 R3 잡음 — \d\d:\d\d 까지/);
    expect(await run(['release'], env)).toBe('폰 R3 놓음 — 팜이 깐 앱 · 앱 데이터를 정리한다');

    expect(주소들()).toEqual([
      'GET http://farm:4723/api/devices?status=idle',
      'POST http://farm:4723/api/devices/R3/hold',
      'DELETE http://farm:4723/api/devices/R3/hold',
    ]);
    expect(JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string)).toEqual({ minutes: 30 });
    expect(existsSync('.appium-cli/held')).toBe(false);
  });

  it('udid 를 주면 목록을 보지 않고 그 폰을 잡는다', async () => {
    await run(['hold', '--udid', 'ZZ', '--minutes', '60'], env);

    expect(주소들()).toEqual(['POST http://farm:4723/api/devices/ZZ/hold']);
  });

  it('팜이 거절하면 이유를 그대로 낸다', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ refused: '남이 잡은 폰' }), { status: 409 }));

    await expect(run(['hold', '--udid', 'ZZ'], env)).rejects.toThrow('HTTP 409 로 답했다: 남이 잡은 폰');
    expect(existsSync('.appium-cli/held')).toBe(false);
  });

  it('잡는 시간은 30 · 60 · 120 분만 받는다', async () => {
    await expect(run(['hold', '--minutes', '45'], env)).rejects.toThrow('30 · 60 · 120');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('logcat', () => {
  const 줄 = (message: string): { timestamp: number; level: string; message: string } => ({ timestamp: 0, level: 'ALL', message });
  const 쌓인줄 = [줄('10-20 10:00:00.000  1  1 I Boot: 옛 줄')];
  const 새줄 = [
    줄('10-20 10:07:55.318 18524 18524 I okhttp.OkHttpClient: --> GET https://api.shop/v1/items?token=abc&q=신발'),
    줄('10-20 10:07:55.500 18524 18524 I okhttp.OkHttpClient: <-- 200 OK https://api.shop/v1/items (182ms)'),
    줄('10-20 10:07:56.001 18524 18524 D Touch: tap'),
    줄('10-20 10:07:56.100 18524 18524 I okhttp.OkHttpClient: --> POST https://api.shop/v1/cart#frag'),
  ];
  // se/log 를 부를 때마다 앞에서 하나씩 준다
  function 로그답(...차례: unknown[][]): void {
    const 기본 = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => (url.endsWith('/se/log') ? 답(차례.shift() ?? []) : 기본(url, init)));
  }

  it('logs 첫 호출은 쌓인 줄을 버리고, 다음부터 새 줄을 그대로 낸다', async () => {
    로그답(쌓인줄, 새줄, []);

    expect(await run(['-s=probe', 'logs'], env)).toBe('쌓인 줄 1개를 버렸다 — 다음 logs 부터 새 줄만 낸다');
    expect((await run(['-s=probe', 'logs'], env)).split('\n')).toEqual(새줄.map((e) => e.message));
    expect(await run(['-s=probe', 'logs'], env)).toBe('새 줄 없음');

    expect(부른길()).toEqual(Array(3).fill('POST /session/s-1/se/log'));
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({ type: 'logcat' });
  });

  it('logs --grep 은 /식/i 꼴로 거른다', async () => {
    로그답(쌓인줄, 새줄);
    await run(['-s=probe', 'logs'], env);

    expect(await run(['-s=probe', 'logs', '--grep', '/TOUCH/i'], env)).toBe('10-20 10:07:56.001 18524 18524 D Touch: tap');
  });

  it('logs --api 는 OkHttp 요청 줄만 METHOD URL 로, 물음표 · # 뒤는 지운다', async () => {
    로그답(쌓인줄, 새줄);
    await run(['-s=probe', 'logs'], env);

    expect(await run(['-s=probe', 'logs', '--api'], env)).toBe('GET https://api.shop/v1/items\nPOST https://api.shop/v1/cart');
  });

  it('--api-pattern 으로 꼴을 바꾸고, 모임이 둘이 아니면 Appium 을 부르기 전에 던진다', async () => {
    로그답(쌓인줄, [줄('10-20 10:07:57.000 1 1 I Net: req PUT https://api.shop/v1/me?x=1')]);
    await run(['-s=probe', 'logs'], env);
    fetchMock.mockClear();

    await expect(run(['-s=probe', 'logs', '--api-pattern', 'req (\\w+)'], env)).rejects.toThrow('모임 둘');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await run(['-s=probe', 'logs', '--api-pattern', 'req (\\w+) (\\S+)'], env)).toBe('PUT https://api.shop/v1/me');
  });

  it('apis --file 은 팜 logcat 파일에서 [{method, url, at}] 를 낸다', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile('logcat.txt', `${새줄.map((e) => e.message).join('\r\n')}\n`);

    expect(JSON.parse(await run(['apis', '--file', 'logcat.txt'], env))).toEqual([
      { method: 'GET', url: 'https://api.shop/v1/items', at: '10-20 10:07:55.318' },
      { method: 'POST', url: 'https://api.shop/v1/cart', at: '10-20 10:07:56.100' },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('내보낸 apiLines 는 apis --file 과 같은 값을 낸다', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile('logcat.txt', 새줄.map((e) => e.message).join('\n'));

    expect(입구.apiLines(새줄.map((e) => e.message))).toEqual(JSON.parse(await run(['apis', '--file', 'logcat.txt'], env)));
  });

  it('라이브러리는 screenKey · parseSource · apiLines · farmArtifacts 만 낸다', () => {
    expect(Object.keys(입구).sort()).toEqual(['apiLines', 'farmArtifacts', 'parseSource', 'screenKey']);
  });

  it('apis --session-id 는 CLI session 파일 없이 남의 session 을 읽고 쌓인 줄도 버리지 않는다', async () => {
    로그답(새줄);

    const out = JSON.parse(await run(['apis', '--session-id', 'kit-7'], env)) as { url: string }[];

    expect(out.map((a) => a.url)).toEqual(['https://api.shop/v1/items', 'https://api.shop/v1/cart']);
    expect(부른길()).toEqual(['POST /session/kit-7/se/log']);
  });

  it('apis 에 읽을 곳이 없으면 던진다', async () => {
    await expect(run(['apis'], env)).rejects.toThrow('--session-id <id> 나 --file');
  });
});

describe('팜 산출물', () => {
  const 영상 = Buffer.from([0x00, 0xff, 0x1a, 0x45, 0xdf, 0xa3, 0x0d, 0x0a]);
  const 목록 = (sid: string, ready = true, files = [
    { name: 'logcat.txt', bytes: 11, url: `/wd/hub/api/sessions/${sid}/artifacts/logcat.txt` },
    { name: 'video-1.mp4', bytes: 영상.length, url: `/wd/hub/api/sessions/${sid}/artifacts/video-1.mp4` },
  ]): Response => 답({ sessionId: sid, ready, files: ready ? files : [], errors: [] });
  // 목록을 부를 때마다 앞에서 하나씩 준다 — 실측 팜 답 꼴(files[].url 은 팜 원점 기준 경로)
  function 산출물답(...차례: Response[]): void {
    const 기본 = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/artifacts')) return 차례.shift()!;
      if (url.endsWith('/logcat.txt')) return new Response('줄 하나\n');
      if (url.endsWith('/video-1.mp4')) return new Response(영상);
      return 기본(url, init);
    });
  }
  const 주소들 = (): string[] => (fetchMock.mock.calls as [string, RequestInit][]).map(([u]) => u);

  it('session 번호를 주면 목록을 읽고 파일마다 같은 인증 머리로 받아 한 줄씩 낸다', async () => {
    산출물답(목록('kit-7'));

    const out = await run(['artifacts', 'kit-7', '--out', 'got'], { ...env, PLATFORM_APPIUM_TOKEN: 'pat_x' });

    expect(out).toBe('- logcat.txt 11 bytes: got/logcat.txt\n- video-1.mp4 8 bytes: got/video-1.mp4');
    expect(주소들()).toEqual([
      'http://farm:4723/wd/hub/api/sessions/kit-7/artifacts',
      'http://farm:4723/wd/hub/api/sessions/kit-7/artifacts/logcat.txt',
      'http://farm:4723/wd/hub/api/sessions/kit-7/artifacts/video-1.mp4',
    ]);
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) expect((init.headers as Record<string, string>).Authorization).toBe('Bearer pat_x');
    expect(readFileSync('got/video-1.mp4').equals(영상)).toBe(true);
    expect(readFileSync('got/logcat.txt', 'utf8')).toBe('줄 하나\n');
  });

  it('번호가 없으면 이 이름으로 마지막에 close 한 session 을 기본 폴더에 받는다', async () => {
    await expect(run(['-s=probe', 'artifacts'], env)).rejects.toThrow('close 를 먼저 한다');
    await run(['-s=probe', 'close'], env);
    산출물답(목록('s-1'));
    fetchMock.mockClear();

    const out = await run(['-s=probe', 'artifacts'], env);

    expect(out.split('\n')[0]).toBe('- logcat.txt 11 bytes: .appium-cli/artifacts/s-1/logcat.txt');
    expect(주소들()[0]).toBe('http://farm:4723/wd/hub/api/sessions/s-1/artifacts');
    expect(await run(['list'], env)).toBe('열린 session 이 없다');
  });

  it('팜이 아직 만드는 중(ready:false)이면 다시 보고, 시간이 지나면 까닭을 붙여 던진다', async () => {
    가라앉기.산출물_ms = 1000;
    산출물답(목록('kit-7', false), 목록('kit-7', false), 목록('kit-7'));
    expect(await run(['artifacts', 'kit-7'], env)).toMatch(/^- logcat\.txt/);
    expect(주소들().filter((u) => u.endsWith('/artifacts'))).toHaveLength(3);

    가라앉기.산출물_ms = 0;
    산출물답(목록('kit-7', false));
    await expect(run(['artifacts', 'kit-7'], env)).rejects.toThrow('ready:false');
  });

  it('폴더 밖으로 나가는 파일 이름이면 아무것도 받지 않고 던진다', async () => {
    산출물답(목록('kit-7', true, [
      { name: 'logcat.txt', bytes: 11, url: '/wd/hub/api/sessions/kit-7/artifacts/logcat.txt' },
      { name: '../evil.sh', bytes: 1, url: '/x' },
    ]));

    await expect(run(['artifacts', 'kit-7', '--out', 'got'], env)).rejects.toThrow('파일 이름을 쓸 수 없다: "../evil.sh"');
    expect(주소들()).toHaveLength(1);
    expect(existsSync('got/logcat.txt')).toBe(false);
  });

  it('farmArtifacts 는 CLI 와 같은 길로 받고 팜 오류도 돌려준다', async () => {
    산출물답(답({ sessionId: 'kit-7', ready: true, files: [{ name: 'video-1.mp4', bytes: 8, url: '/wd/hub/api/sessions/kit-7/artifacts/video-1.mp4' }], errors: ['logcat 없음'] }));

    const r = await 입구.farmArtifacts('http://farm:4723/wd/hub', 'kit-7', 'lib', { token: 'pat_y' });

    expect(r).toEqual({ files: [{ name: 'video-1.mp4', bytes: 8, path: 'lib/video-1.mp4' }], errors: ['logcat 없음'] });
    expect(((fetchMock.mock.calls[1] as [string, RequestInit])[1].headers as Record<string, string>).Authorization).toBe('Bearer pat_y');
  });
});
