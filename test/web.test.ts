// 앱 안 웹 화면(웹뷰) 맥락 — contexts · context · 웹 화면 읽기 · 웹 선택자 · 웹 맥락에서 막는 명령을 본다

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { 가라앉기 } from '../src/appium.js';
import { run } from '../src/cli.js';
import { aria식, 웹w3c, 웹읽기, 웹주소글, 태그글식 } from '../src/web.js';

import { 화면XML } from './fixture.js';

const fetchMock = vi.fn();
const env = { PLATFORM_APPIUM_URL: 'http://farm:4723/wd/hub', PLATFORM_APP: '/apk/dev.apk' };
const 답 = (value: unknown, status = 200): Response => new Response(JSON.stringify({ value }), { status });
const 요소 = (id: string): Record<string, string> => ({ 'element-6066-11e4-a52e-4f735466cecf': id });
const WEB = 'WEBVIEW_com.shop';

let 맥락목록 = ['NATIVE_APP', WEB];
let 지금맥락 = 'NATIVE_APP';
let 찾은: Record<string, string>[] = [];
let 보임 = true;
let 웹줄 = ['button "구매" [ref=w1]', 'link "자세히" [ref=w2]'];
const 주소들: Record<string, object> = { w1: { loc: '[data-testid="buy"]' }, w2: { loc: null } };

function 가짜(): void {
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace('http://farm:4723/wd/hub', '');
    const body = init.body === undefined ? undefined : (JSON.parse(String(init.body)) as { script?: string; name?: string; args?: string[] });
    if (path === '/session') return 답({ sessionId: 's-1', capabilities: { appPackage: 'com.shop' } });
    if (path.endsWith('/contexts')) return 답(맥락목록);
    if (path.endsWith('/context') && init.method === 'GET') return 답(지금맥락);
    if (path.endsWith('/context')) {
      지금맥락 = body!.name!;
      return 답(null);
    }
    if (path.endsWith('/source')) return 답(화면XML);
    if (path.endsWith('/execute/sync') && body?.script === 웹읽기) return 답({ title: '상세', url: 'https://shop.test/order', 줄: 웹줄, 넘침: 0 });
    if (path.endsWith('/execute/sync') && body?.script === 웹주소글) return 답(주소들[body.args![0]!] ?? { 없음: true });
    if (path.endsWith('/elements')) return 답(찾은);
    if (path.endsWith('/element')) return 답(요소('el-1'));
    const 표 = /\/element\/([\w-]+)\/attribute\/data-appium-cli-ref$/.exec(path);
    if (표) return 답(표[1] === 'el-1' ? 'w1' : null);
    if (path.endsWith('/displayed')) return 답(보임);
    return 답(init.method === 'DELETE' ? null : {});
  });
}
const 부른길 = (): string[] => (fetchMock.mock.calls as [string, RequestInit][]).map(([u, i]) => `${i.method} ${u.replace('http://farm:4723/wd/hub', '')}`);
const 보낸몸 = (끝: string): unknown[] =>
  (fetchMock.mock.calls as [string, RequestInit][]).filter(([u, i]) => u.endsWith(끝) && i.body !== undefined).map(([, i]) => JSON.parse(String(i.body)) as unknown);

beforeEach(async () => {
  Object.assign(가라앉기, { 최대_ms: 0, 간격_ms: 0, 찾기_ms: 10_000 });
  process.chdir(mkdtempSync(join(tmpdir(), 'appium-cli-web-')));
  맥락목록 = ['NATIVE_APP', WEB];
  지금맥락 = 'NATIVE_APP';
  찾은 = [];
  보임 = true;
  웹줄 = ['button "구매" [ref=w1]', 'link "자세히" [ref=w2]'];
  fetchMock.mockReset();
  가짜();
  vi.stubGlobal('fetch', fetchMock);
  await run(['-s=probe', 'open'], env);
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const 웹으로 = (): Promise<string> => run(['-s=probe', 'context', WEB], env);

describe('contexts · context', () => {
  it('contexts 는 맥락마다 한 줄 · 지금 맥락에 (지금), 웹뷰가 없으면 까닭을 붙인다', async () => {
    expect(await run(['-s=probe', 'contexts'], env)).toBe(`- NATIVE_APP (지금)\n- ${WEB}`);
    맥락목록 = ['NATIVE_APP'];
    expect((await run(['-s=probe', 'contexts'], env)).split('\n')[1]).toContain('웹뷰 디버깅을 켠 빌드');
  });

  it('context 는 맥락을 바꾸고 웹 화면을 찍는다 — Ran 줄은 웹뷰에서 구간 꼴을 알리고 NATIVE_APP 이면 네이티브 화면으로 돌아온다', async () => {
    const 줄 = (await 웹으로()).split('\n');
    expect(줄[0]).toBe('Ran: // 케이스에서는 구간으로 쓴다 — await 웹뷰에서(driver, async () => { … })');
    expect(보낸몸('/context')).toEqual([{ name: WEB }]);
    const 화면 = readFileSync(줄[1]!.replace('- Snapshot: ', ''), 'utf8');
    expect(화면).toBe(`웹 화면 ${WEB} · "상세" · https://shop.test/order · 요소 2개\n- button "구매" [ref=w1]\n- link "자세히" [ref=w2]`);
    expect(부른길()).not.toContain('GET /session/s-1/source');

    fetchMock.mockClear();
    const 돌아옴 = (await run(['-s=probe', 'context', 'NATIVE_APP'], env)).split('\n');
    expect(돌아옴[0]).toBe('Ran: // 케이스에서는 웹뷰에서 구간이 끝나면 kit 이 네이티브로 되돌린다');
    expect(부른길()).toContain('GET /session/s-1/source');
  });

  it('없는 맥락은 바꾸지 않고 있는 것을 알려 준다', async () => {
    await expect(run(['-s=probe', 'context', 'WEBVIEW_x'], env)).rejects.toThrow(`WEBVIEW_x 맥락이 없다 — 지금 있는 것: NATIVE_APP · ${WEB}`);
    expect(보낸몸('/context')).toEqual([]);
  });

  it('attach 는 케이스가 웹 맥락에 있으면 웹 화면으로 찍는다', async () => {
    지금맥락 = WEB;
    const out = await run(['-s=kit', 'attach', 's-9'], env);
    expect(readFileSync(out.split('\n')[1]!.replace('- Snapshot: ', ''), 'utf8')).toContain(`웹 화면 ${WEB}`);
    await expect(run(['-s=kit', 'context', 'NATIVE_APP'], env)).rejects.toThrow('--force');
  });
});

describe('웹 맥락의 누르기 · 넣기 · 확인', () => {
  beforeEach(async () => {
    await 웹으로();
    fetchMock.mockClear();
  });

  it('tap 은 ref 의 선택자로 찾아 누르고, 선택자 없는 ref 는 화면에 단 표로 찾아 누르고 까닭을 적는다', async () => {
    expect((await run(['-s=probe', 'tap', 'w1'], env)).split('\n')[0]).toBe(`Ran: await driver.$('[data-testid="buy"]').click()`);
    expect(보낸몸('/element')[0]).toEqual({ using: 'css selector', value: '[data-testid="buy"]' });

    찾은 = [요소('el-2')];
    fetchMock.mockClear();
    const 줄 = (await run(['-s=probe', 'tap', 'w2'], env)).split('\n')[0];
    expect(줄).toMatch(/^Ran: \/\/ 주소 없음 — .* \(ref 로 눌렀다\)$/);
    expect(보낸몸('/elements')[0]).toEqual({ using: 'css selector', value: '[data-appium-cli-ref="w2"]' });
    expect(부른길()).toContain('POST /session/s-1/element/el-2/click');
  });

  it('tap 은 aria/ · 태그=글 선택자를 WebdriverIO 와 같은 XPath 로 찾는다 — 네이티브 ref 는 바로 거절한다', async () => {
    await run(['-s=probe', 'tap', 'aria/장바구니'], env);
    await run(['-s=probe', 'tap', 'button=장바구니'], env);
    expect(보낸몸('/element')).toEqual([
      { using: 'xpath', value: aria식('장바구니') },
      { using: 'xpath', value: 태그글식('button', '장바구니') },
    ]);
    await expect(run(['-s=probe', 'tap', 'e3'], env)).rejects.toThrow('e3 는 네이티브 화면의 ref 다');
  });

  it('fill 은 WebdriverIO setValue 처럼 비우고 넣는다 — --submit 은 거절한다', async () => {
    expect((await run(['-s=probe', 'fill', 'w1', '쿠폰'], env)).split('\n')[0]).toBe(`Ran: await driver.$('[data-testid="buy"]').setValue('쿠폰')`);
    expect(부른길().filter((x) => x.includes('/element/el-1/'))).toEqual(['POST /session/s-1/element/el-1/clear', 'POST /session/s-1/element/el-1/value']);
    await expect(run(['-s=probe', 'fill', 'w1', '쿠폰', '--submit'], env)).rejects.toThrow('--submit 을 못 쓴다');
  });

  it('count 는 맞은 요소마다 웹 화면이 단 ref 를 읽는다 · generate-locator ref 는 고른 선택자나 까닭', async () => {
    찾은 = [요소('el-1'), 요소('el-9')];
    expect((await run(['-s=probe', 'count', 'aria/구매'], env)).split('\n').slice(0, 3)).toEqual(['Count: 2 — 겹친다. 하나만 맞아야 케이스에 쓴다', '- w1', '- 마지막 화면에 없는 요소']);
    expect(await run(['-s=probe', 'generate-locator', 'w1'], env)).toBe(`driver.$('[data-testid="buy"]')`);
    expect(await run(['-s=probe', 'generate-locator', 'w2'], env)).toMatch(/^주소 없음 — /);
    await expect(run(['-s=probe', 'generate-locator', 'w9'], env)).rejects.toThrow('w9 가 지금 웹 화면에 없다 — 페이지가 다시 그려졌다');
  });

  it('누른 뒤 웹 화면은 앞 화면과 달라진 뒤 같은 글을 두 번 읽을 때까지 다시 읽고, 넘어가는 동안의 읽기 실패는 넘긴다', async () => {
    Object.assign(가라앉기, { 최대_ms: 1000, 간격_ms: 0 });
    let 번 = 0;
    const 원래 = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/execute/sync') && String(init.body).includes('최대 = 300')) {
        번++;
        if (번 === 2) return 답({ error: 'javascript error', message: 'document unloaded' }, 500);
        웹줄 = 번 <= 2 ? ['button "구매" [ref=w1]', 'link "자세히" [ref=w2]'] : ['heading "주문 완료" [ref=w1]'];
      }
      return 원래(url, init);
    });
    const 줄 = (await run(['-s=probe', 'tap', 'w1'], env)).split('\n');
    expect(readFileSync(줄[1]!.replace('- Snapshot: ', ''), 'utf8')).toContain('heading "주문 완료"');
    expect(번).toBe(4);
  });

  it('wait 은 선택자가 보일 때까지 · Ran 줄은 WebdriverIO waitForDisplayed — 글자 기다리기는 거절한다', async () => {
    찾은 = [요소('el-1')];
    expect((await run(['-s=probe', 'wait', 'aria/완료'], env)).split('\n')[0]).toBe("Ran: await driver.$('aria/완료').waitForDisplayed({ timeout: 10000 })");
    보임 = false;
    expect((await run(['-s=probe', 'wait', 'aria/완료', '--gone', '--timeout', '5000'], env)).split('\n')[0]).toBe(
      "Ran: await driver.$('aria/완료').waitForDisplayed({ reverse: true, timeout: 5000 })",
    );
    await expect(run(['-s=probe', 'wait', '--text', '완료'], env)).rejects.toThrow('선택자로 기다린다');
  });

  it('visible 은 WebdriverIO isDisplayed 줄을 낸다', async () => {
    찾은 = [];
    expect(await run(['-s=probe', 'visible', '#pay'], env)).toBe("Ran: await driver.$('#pay').isDisplayed()\nVisible: 아니오");
  });

  it('네이티브 화면 글 · 손짓 · 키보드 · 앱 다시 띄우기 명령은 막는다', async () => {
    for (const 명령 of [['swipe', 'up'], ['scroll-to', '리뷰'], ['long-press', 'w1'], ['app', 'restart'], ['crawl']]) {
      await expect(run(['-s=probe', ...명령], env)).rejects.toThrow(`웹 맥락(${WEB})에서는 ${명령[0]} 을 못 쓴다`);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(run(['-s=probe', 'wait', 'w1'], env)).rejects.toThrow('wait 은 ref 가 아니라 선택자를 받는다');
  });
});

describe('웹w3c · 웹 화면 읽기 글', () => {
  it('웹 케이스 순서의 꼴만 받고 네이티브 · WebdriverIO 의 다른 꼴은 거절한다', () => {
    expect(웹w3c('[data-testid="buy"]')).toEqual({ using: 'css selector', value: '[data-testid="buy"]' });
    expect(웹w3c('input[placeholder="쿠폰 코드"]')).toEqual({ using: 'css selector', value: 'input[placeholder="쿠폰 코드"]' });
    expect(웹w3c('//div[@id="x"]')).toEqual({ using: 'xpath', value: '//div[@id="x"]' });
    expect(웹w3c('a=자세히')).toEqual({ using: 'xpath', value: './/a[normalize-space(text()) = "자세히"] | .//a[not(.//a[normalize-space(text()) = "자세히"]) and normalize-space() = "자세히"]' });
    for (const x of ['~로그인', 'id=com.shop:id/pw', 'android=new UiSelector()', '=자세히', '*=자세', 'button.primary=구매', 'a=말 "따옴표"']) {
      expect(() => 웹w3c(x), x).toThrow('웹 맥락에서는');
    }
  });

  it('aria 식은 WebdriverIO 처럼 큰따옴표 · 작은따옴표가 다 든 이름을 concat 으로 짓는다', () => {
    expect(aria식('결제')).toContain('.//*[@aria-label = "결제"]');
    expect(aria식('결제 "지금"')).toContain(`.//*[@aria-label = '결제 "지금"']`);
    expect(aria식(`it's "x"`)).toContain(`.//*[@aria-label = concat("it's ", '"', "x", '"')]`);
  });

  it('웹 화면 읽기 글은 페이지에서 돌 수 있는 함수 몸이다', () => {
    expect(() => new Function(웹읽기)).not.toThrow();
  });
});
