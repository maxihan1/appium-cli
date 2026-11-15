// 찾기 · 확인 명령(count · visible · wait-any · scroll-to · info · settings · 요소 사진)과 android= 선택자 · 선택됨 · 포커스 줄을 본다

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { 가라앉기 } from '../src/appium.js';
import { run } from '../src/cli.js';
import { 지문 } from '../src/crawl.js';
import { 글자지문 } from '../src/crawl-out.js';
import { parseSource } from '../src/platform/android.js';

import { 화면XML } from './fixture.js';

const fetchMock = vi.fn();
const env = { PLATFORM_APPIUM_URL: 'http://farm:4723/wd/hub', PLATFORM_APP: '/apk/dev.apk' };
const 답 = (value: unknown, status = 200): Response => new Response(JSON.stringify({ value }), { status });
const 요소 = (id: string): Record<string, string> => ({ 'element-6066-11e4-a5ab-c8d2b5b44a87': id });

// 테스트마다 바꾸는 폰 쪽 값
let 찾은: Record<string, string>[] = [];
let 보임 = true;
let 실패할스크립트 = '';
const 자리들: Record<string, object> = {
  'el-1': { x: 10, y: 50, width: 20, height: 20 },
  'el-2': { x: 500, y: 500, width: 10, height: 10 },
};

function 가짜(): void {
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace('http://farm:4723/wd/hub', '');
    const body = init.body === undefined ? undefined : (JSON.parse(String(init.body)) as { script?: string });
    if (path === '/session') return 답({ sessionId: 's-1', capabilities: { appPackage: 'com.shop' } });
    if (path.endsWith('/source')) return 답(화면XML);
    if (path.endsWith('/elements')) return 답(찾은);
    if (path.endsWith('/element')) return 답(요소('el-1'));
    const 자리 = /\/element\/([\w-]+)\/rect$/.exec(path);
    if (자리) return 답(자리들[자리[1]!]);
    if (path.endsWith('/displayed')) return 답(보임);
    if (path.endsWith('/screenshot')) return 답(Buffer.from('png').toString('base64'));
    if (path.endsWith('/current_activity')) return 답('.MainActivity');
    if (path.endsWith('/is_keyboard_shown')) return 답(true);
    if (path.endsWith('/appium/settings') && init.method === 'GET') return 답({ waitForIdleTimeout: 10000, enableMultiWindows: false });
    if (path.endsWith('/execute/sync')) {
      if (body?.script === 실패할스크립트) return 답({ error: 'unknown method', message: '팜이 막았다' }, 500);
      if (body?.script === 'mobile: queryAppState') return 답(4);
      if (body?.script === 'mobile: deviceInfo') return 답({ manufacturer: 'samsung', model: 'SM-G996N', platformVersion: '15', realDisplaySize: '1080x2400' });
      if (body?.script === 'mobile: batteryInfo') return 답({ level: 0.87, state: 2 });
    }
    return 답(init.method === 'DELETE' ? null : {});
  });
}
const 부른길 = (): string[] => (fetchMock.mock.calls as [string, RequestInit][]).map(([u, i]) => `${i.method} ${u.replace('http://farm:4723/wd/hub', '')}`);
const 보낸몸 = (끝: string): unknown[] =>
  (fetchMock.mock.calls as [string, RequestInit][]).filter(([u, i]) => u.endsWith(끝) && i.body !== undefined).map(([, i]) => JSON.parse(String(i.body)) as unknown);

beforeEach(async () => {
  Object.assign(가라앉기, { 최대_ms: 0, 간격_ms: 0, 찾기_ms: 10_000 });
  process.chdir(mkdtempSync(join(tmpdir(), 'appium-cli-find-')));
  찾은 = [];
  보임 = true;
  실패할스크립트 = '';
  fetchMock.mockReset();
  가짜();
  vi.stubGlobal('fetch', fetchMock);
  await run(['-s=probe', 'open'], env);
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const 부모꼴 = 'android=new UiSelector().resourceId("com.shop:id/root").childSelector(new UiSelector().text("할인"))';

describe('android= 선택자(부모 꼴 · 뜨는 창 꼴)', () => {
  it('tap 은 -android uiautomator 로 찾아 누르고 Ran 줄에 선택자를 그대로 싣는다', async () => {
    const out = await run(['-s=probe', 'tap', 부모꼴], env);

    expect(out.split('\n')[0]).toBe(`Ran: await driver.$('${부모꼴}').click()`);
    expect(보낸몸('/element')[0]).toEqual({ using: '-android uiautomator', value: 부모꼴.slice('android='.length) });
  });

  it('wait 는 화면 글로 못 맞추니 폰에 물어 보일 때까지 기다린다', async () => {
    찾은 = [요소('el-1')];
    const out = await run(['-s=probe', 'wait', 부모꼴], env);

    expect(out.split('\n')[0]).toBe(`Ran: await 뜰때까지(driver, '${부모꼴}')`);
    expect(부른길()).toContain('GET /session/s-1/element/el-1/displayed');
  });
});

describe('count · generate-locator <선택자>', () => {
  it('count 는 지금 화면을 찍고 몇 개 맞나와 맞은 자리의 ref 를 낸다 — 마지막 화면에 없는 자리는 그렇다고 한다', async () => {
    찾은 = [요소('el-1'), 요소('el-2')];
    const 줄 = (await run(['-s=probe', 'count', 부모꼴], env)).split('\n');

    expect(줄.slice(0, 3)).toEqual(['Count: 2 — 겹친다. 하나만 맞아야 케이스에 쓴다', '- [10,50][30,70] — e3', '- [500,500][510,510] — 마지막 화면에 없는 자리']);
    expect(줄[3]).toMatch(/^- Snapshot: /);
    expect(부른길()[0]).toBe('GET /session/s-1/source');
  });

  it('count 는 못 찾으면 0 · 하나면 하나만 맞는다고 하고, 선택자가 아니면 Appium 을 부르지 않는다', async () => {
    expect((await run(['-s=probe', 'count', '~없음'], env)).split('\n')[0]).toBe('Count: 0 — 못 찾았다');
    찾은 = [요소('el-1')];
    expect((await run(['-s=probe', 'count', 'id=com.shop:id/pw'], env)).split('\n')[0]).toBe('Count: 1 — 하나만 맞는다');
    fetchMock.mockClear();
    await expect(run(['-s=probe', 'count', 'e3'], env)).rejects.toThrow('선택자');
    expect(부른길()).toEqual([]);
  });

  it('generate-locator 에 선택자를 주면 하나만 맞을 때만 코드를 내고, 겹치면 자리를 실어 던진다', async () => {
    찾은 = [요소('el-1')];
    expect((await run(['-s=probe', 'generate-locator', 부모꼴], env)).split('\n').slice(0, 2)).toEqual([`driver.$('${부모꼴}')`, '- [10,50][30,70] — e3']);
    찾은 = [요소('el-1'), 요소('el-2')];
    await expect(run(['-s=probe', 'generate-locator', 부모꼴], env)).rejects.toThrow('Count: 2');
  });
});

describe('visible · wait-any · scroll-to', () => {
  it('visible 은 기다리지 않고 첫 요소가 보이는지 — 없으면 displayed 를 묻지 않는다', async () => {
    expect(await run(['-s=probe', 'visible', '~로그인'], env)).toBe("Ran: await 보이나(driver, '~로그인')\nVisible: 아니오");
    expect(부른길()).not.toContain('GET /session/s-1/element/el-1/displayed');
    찾은 = [요소('el-1')];
    expect((await run(['-s=probe', 'visible', '~로그인'], env)).split('\n')[1]).toBe('Visible: 예');
  });

  it('wait-any 는 먼저 보이는 후보와 먼저뜨는것 코드를 낸다 — --timeout 은 코드에도 실린다', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/elements')) {
        const { value } = JSON.parse(String(init.body)) as { value: string };
        return 답(value === 'home' ? [요소('el-1')] : []);
      }
      return 답(url.endsWith('/source') ? 화면XML : true);
    });
    const 줄 = (await run(['-s=probe', 'wait-any', '~로그인', 'id=home', '--timeout', '5000'], env)).split('\n');

    expect(줄[0]).toBe("Ran: await 먼저뜨는것(driver, { '~로그인': '~로그인', 'id=home': 'id=home' }, 5000)");
    expect(줄[1]).toBe('Found: id=home');
  });

  it('wait-any 는 시간 안에 아무것도 안 뜨면 던지고, 후보가 하나뿐이면 Appium 을 안 부른다', async () => {
    await expect(run(['-s=probe', 'wait-any', '~a', '~b', '--timeout', '1'], env)).rejects.toThrow('후보 2개 가운데');
    fetchMock.mockClear();
    await expect(run(['-s=probe', 'wait-any', '~a'], env)).rejects.toThrow('둘 이상');
    expect(부른길()).toEqual([]);
  });

  it('scroll-to 는 kit 스크롤해서찾기 와 같은 선택자로 한 번 찾고 그 코드와 새 화면을 준다 — 못 찾으면 까닭을 붙여 던진다', async () => {
    const out = await run(['-s=probe', 'scroll-to', '리뷰 "많은" 순'], env);

    expect(out.split('\n')[0]).toBe('Ran: await 스크롤해서찾기(driver, \'리뷰 "많은" 순\')');
    expect(보낸몸('/element')).toEqual([
      { using: '-android uiautomator', value: 'new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().textContains("리뷰 \\"많은\\" 순"))' },
    ]);

    fetchMock.mockImplementation(async (url: string) => (url.endsWith('/element') ? 답({ error: 'no such element', message: '없다' }, 404) : 답(화면XML)));
    await expect(run(['-s=probe', 'scroll-to', '없는 글'], env)).rejects.toThrow('「없는 글」가 든 요소를 굴려도 찾지 못했다');
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/element'))).toHaveLength(2);
  });
});

describe('info · settings · 요소 사진', () => {
  it('info 는 띄운 앱의 상태 · 화면 · 키보드 · 폰 · 배터리를 한 줄씩 — 막힌 줄은 모름과 까닭', async () => {
    실패할스크립트 = 'mobile: batteryInfo';
    expect((await run(['-s=probe', 'info'], env)).split('\n')).toEqual([
      "앱: com.shop — 앞에 떠 있다 (await driver.queryAppState('com.shop') → 4)",
      '화면: .MainActivity',
      '키보드: 올라와 있다 (await driver.isKeyboardShown())',
      '폰: samsung · SM-G996N · Android 15 · 1080x2400',
      '배터리: 모름 — Appium 이 HTTP 500 로 답했다: 팜이 막았다',
    ]);
  });

  it('settings 는 인자 없이 지금 설정을, 키=값 이면 바꾸고 화면 멈춤 기다림은 움직이는화면에서 구간 꼴을 알린다', async () => {
    expect(await run(['-s=probe', 'settings'], env)).toBe('waitForIdleTimeout=10000\nenableMultiWindows=false');
    expect(await run(['-s=probe', 'settings', 'waitForIdleTimeout=1000'], env)).toBe(
      'Ran: // 케이스에서는 구간으로 쓴다 — await 움직이는화면에서(driver, async () => { … }, 1000)\nSet: waitForIdleTimeout=1000',
    );
    expect(보낸몸('/appium/settings')).toEqual([{ settings: { waitForIdleTimeout: 1000 } }]);
    expect((await run(['-s=probe', 'settings', 'enableMultiWindows=true'], env)).split('\n')[0]).toBe('Ran: // 케이스에 옮길 부품이 없다 — 탐색에서만 바꾼다');
  });

  it('붙은 session 의 설정은 --force 없이 안 바꾸고, 보기는 된다', async () => {
    await run(['-s=probe', 'close'], env);
    await run(['-s=kit', 'attach', 's-9'], env);
    fetchMock.mockClear();
    await expect(run(['-s=kit', 'settings', 'waitForIdleTimeout=1000'], env)).rejects.toThrow('--force');
    expect(부른길()).toEqual([]);
    expect(await run(['-s=kit', 'settings'], env)).toContain('waitForIdleTimeout=10000');
  });

  it('screenshot 에 ref · 선택자를 주면 그 요소만 찍고, 주소 없는 ref 는 찍지 않고 던진다', async () => {
    expect(await run(['-s=probe', 'screenshot', 'e3', '--filename', 'a.png'], env)).toBe('- Screenshot: a.png');
    expect(부른길()).toContain('GET /session/s-1/element/el-1/screenshot');
    await expect(run(['-s=probe', 'screenshot', 'e2'], env)).rejects.toThrow('주소 없음');
  });
});

describe('화면 줄의 선택됨 · 포커스', () => {
  const xml = (선택: boolean, 포커스: boolean): string =>
    `<hierarchy width="100" height="100"><android.widget.TextView text="홈" clickable="true" selected="${선택}" focused="${포커스}" bounds="[0,0][10,10]" resource-id="tab_home" content-desc="" /></hierarchy>`;

  it('고른 탭 · 입력을 받는 칸에 선택됨 · 포커스를 달되 지문 · 글자지문은 안 단 화면과 같다', () => {
    const 단 = parseSource(xml(true, true)).글;
    const 안단 = parseSource(xml(false, false)).글;

    expect(단.split('\n')[1]).toBe('TextView text="홈" id=tab_home 클릭 선택됨 포커스 [0,0][10,10] [ref=e1]');
    expect(지문(단)).toBe(지문(안단));
    expect(글자지문(`# app:.Main/x\n${단}`)).toBe(글자지문(`# app:.Main/x\n${안단}`));
  });
});
