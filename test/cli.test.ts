// CLI 명령이 Appium 에 보내는 요청 순서 · 출력 · session 파일을 본다. 네트워크는 fetch 가짜로 막는다

import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { run } from '../src/cli.js';

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

  it('마지막 화면에 없는 ref 는 Appium 을 부르지 않고 던진다', async () => {
    await expect(run(['-s=probe', 'tap', 'e99'], env)).rejects.toThrow('ref e99 가 마지막 화면에 없다');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('그 밖의 명령', () => {
  it('fill 은 요소에 값을 보내고 setValue 코드를 준다', async () => {
    const out = await run(['-s=probe', 'fill', 'e4', "a'b"], env);

    expect(부른길().slice(0, 2)).toEqual(['POST /session/s-1/element', 'POST /session/s-1/element/el-9/value']);
    expect(out.split('\n')[0]).toBe("Ran: await driver.$('id=com.shop:id/pw').setValue('a\\'b')");
  });

  it('generate-locator 는 Appium 을 부르지 않고 선택자를 준다', async () => {
    expect(await run(['-s=probe', 'generate-locator', 'e4'], env)).toBe("driver.$('id=com.shop:id/pw')");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('find 는 마지막 화면에서 줄을 찾는다', async () => {
    expect(await run(['-s=probe', 'find', '--regex', '로그인|Jerry'], env)).toBe(
      'TextView text="Tom & Jerry > 1" [10,20][30,40] [ref=e2]\nButton desc="로그인 > 시작" 클릭 꺼짐 [10,50][30,70] [ref=e3]',
    );
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
