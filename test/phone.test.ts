// 폰 상태 명령 — 보기 · 돌리기 · 네트워크 · 위치 · 어두운 화면 · 글자 크기 · 시각이 kit 과 같은 요청을 보내고 앞 상태 · 되돌릴 명령을 내는지 fetch 가짜로 본다

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { 가라앉기 } from '../src/appium.js';
import { run } from '../src/cli.js';

import { 화면XML } from './fixture.js';

const fetchMock = vi.fn();
const env = { PLATFORM_APPIUM_URL: 'http://farm:4723/wd/hub', PLATFORM_APP: '/apk/dev.apk' };
const 답 = (value: unknown, status = 200): Response => new Response(JSON.stringify({ value }), { status });

let 방향 = 'PORTRAIT';
let 망 = { wifi: true, data: false };
let 밤 = 'no';
let 글자 = 'null';
let 셸막힘 = false;

beforeEach(async () => {
  Object.assign(가라앉기, { 최대_ms: 0, 간격_ms: 0, 찾기_ms: 10_000 });
  process.chdir(mkdtempSync(join(tmpdir(), 'appium-cli-')));
  방향 = 'PORTRAIT';
  망 = { wifi: true, data: false };
  밤 = 'no';
  글자 = 'null';
  셸막힘 = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace('http://farm:4723/wd/hub', '');
    const body = init.body === undefined ? undefined : (JSON.parse(init.body as string) as { script?: string; orientation?: string; args?: Record<string, unknown>[] });
    if (path === '/session') return 답({ sessionId: 's-1', capabilities: { appPackage: 'com.shop' } });
    if (path.endsWith('/source')) return 답(화면XML);
    if (path.endsWith('/orientation')) {
      if (init.method === 'POST') 방향 = body!.orientation!;
      return 답(init.method === 'POST' ? null : 방향);
    }
    const arg = body?.args?.[0] ?? {};
    switch (body?.script) {
      case 'mobile: getConnectivity':
        return 답(망);
      case 'mobile: setConnectivity':
        망 = { ...망, ...arg };
        return 답(null);
      case 'mobile: getUiMode':
        return 답(밤);
      case 'mobile: setUiMode':
        밤 = String(arg.value);
        return 답(null);
      case 'mobile: shell': {
        if (셸막힘) return 답({ error: 'unknown error', message: 'adb_shell 이 꺼져 있다' }, 500);
        const a = arg.args as string[];
        if (a[0] === 'put') 글자 = a[3]!;
        return 답(a[0] === 'get' ? `${글자}\n` : '');
      }
      case 'mobile: getDeviceTime':
        return 답(arg.format === 'YYYY-MM-DD' ? '2026-11-16' : '2026-11-16T09:30:00+09:00');
      default:
        return 답(init.method === 'DELETE' ? null : {});
    }
  });
  vi.stubGlobal('fetch', fetchMock);
  await run(['-s=probe', 'open'], env);
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const 실행들 = (): unknown[] =>
  (fetchMock.mock.calls as [string, RequestInit][]).filter(([u]) => u.endsWith('/execute/sync')).map(([, i]) => JSON.parse(i.body as string) as unknown);
const 앞줄 = (out: string, n: number): string[] => out.split('\n').slice(0, n);

describe('phone', () => {
  it('인자 없이 부르면 지금 폰 상태 다섯 줄 — 한 번도 안 바꾼 글자 크기(null)는 1 이다', async () => {
    expect(await run(['-s=probe', 'phone'], env)).toBe(
      ['- 방향: 세로', '- 네트워크: 와이파이 켬 · 모바일 데이터 끔', '- 어두운 화면: 끔', '- 글자 크기: 1', '- 시각: 2026-11-16T09:30:00+09:00'].join('\n'),
    );
  });

  it('rotate 는 orientation 을 보내고 구간 꼴 · 앞 방향 · 되돌릴 명령 · 새 화면을 낸다', async () => {
    const out = await run(['-s=probe', 'phone', 'rotate', 'landscape'], env);
    expect(방향).toBe('LANDSCAPE');
    expect(앞줄(out, 3)).toEqual([
      "Ran: // 케이스에서는 구간으로 쓴다 — await 폰상태에서(driver, { 방향: '가로' }, async () => { … })",
      'Was: 방향 세로',
      '- 탐색이 끝나면 되돌린다: phone rotate portrait',
    ]);
    expect(out).toMatch(/\n- Snapshot: /);
  });

  it('network off 는 켜져 있던 것만 끈다 — 모바일 데이터가 없는 폰에 데이터 끄기를 안 보낸다', async () => {
    const out = await run(['-s=probe', 'phone', 'network', 'off'], env);
    expect(실행들()).toEqual([
      { script: 'mobile: getConnectivity', args: [{ services: ['wifi', 'data'] }] },
      { script: 'mobile: setConnectivity', args: [{ wifi: false }] },
    ]);
    expect(앞줄(out, 3)).toEqual([
      "Ran: // 케이스에서는 구간으로 쓴다 — await 폰상태에서(driver, { 네트워크: '끊김' }, async () => { … })",
      'Was: 와이파이 켬 · 모바일 데이터 끔',
      '- 탐색이 끝나면 되돌린다: phone network on',
    ]);
    fetchMock.mockClear();
    expect(앞줄(await run(['-s=probe', 'phone', 'network', 'on'], env), 1)).toEqual(['Ran: // 케이스에서는 폰상태에서 구간이 끝나면 kit 이 되돌린다']);
    expect(망).toEqual({ wifi: true, data: true });
  });

  it('location 은 setGeolocation · reset 은 resetGeolocation — 범위 밖 · 글자는 보내지 않는다', async () => {
    const out = await run(['-s=probe', 'phone', 'location', '--', '-33.86', '151.21'], env);
    expect(실행들()).toEqual([{ script: 'mobile: setGeolocation', args: [{ latitude: -33.86, longitude: 151.21 }] }]);
    expect(앞줄(out, 3)).toEqual([
      'Ran: // 케이스에서는 구간으로 쓴다 — await 폰상태에서(driver, { 위치: { 위도: -33.86, 경도: 151.21 } }, async () => { … })',
      'Was: 진짜 위치',
      '- 탐색이 끝나면 되돌린다: phone location reset',
    ]);
    fetchMock.mockClear();
    await run(['-s=probe', 'phone', 'location', 'reset'], env);
    expect(실행들()).toEqual([{ script: 'mobile: resetGeolocation', args: [{}] }]);
    fetchMock.mockClear();
    for (const 틀림 of [[], ['91', '0'], ['37.5'], ['서울', '역']]) await expect(run(['-s=probe', 'phone', 'location', ...틀림], env)).rejects.toThrow('phone location 은');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dark 는 night 모드를 바꾸고 앞 값이 같으면 되돌릴 명령이 없다', async () => {
    const out = await run(['-s=probe', 'phone', 'dark', 'on'], env);
    expect(밤).toBe('yes');
    expect(앞줄(out, 3)).toEqual(['Ran: // 케이스에서는 구간으로 쓴다 — await 폰상태에서(driver, { 어두운화면: true }, async () => { … })', 'Was: 어두운 화면 no', '- 탐색이 끝나면 되돌린다: phone dark off']);
    expect((await run(['-s=probe', 'phone', 'dark', 'on'], env)).split('\n')[2]).toMatch(/^- Snapshot: /);
  });

  it('font 는 폰 셸로 font_scale 을 넣는다 — 셸이 막히면 까닭을 붙여 던진다 · 배율 밖은 안 보낸다', async () => {
    const out = await run(['-s=probe', 'phone', 'font', '1.3'], env);
    expect(글자).toBe('1.3');
    expect(앞줄(out, 3)).toEqual(['Ran: // 케이스에서는 구간으로 쓴다 — await 폰상태에서(driver, { 글자크기: 1.3 }, async () => { … })', 'Was: 글자 크기 1', '- 탐색이 끝나면 되돌린다: phone font 1']);
    셸막힘 = true;
    await expect(run(['-s=probe', 'phone', 'font', '2'], env)).rejects.toThrow('글자 크기를 못 읽었다(폰 셸 — adb_shell 이 닫혔으면 못 쓴다) — Appium 이 HTTP 500 로 답했다: adb_shell 이 꺼져 있다');
    fetchMock.mockClear();
    for (const 틀림 of ['0', '3.5', 'big']) await expect(run(['-s=probe', 'phone', 'font', 틀림], env)).rejects.toThrow('phone font 는');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('time 은 getDeviceTime — 꼴을 주면 싣고 Ran 줄에도 옮긴다', async () => {
    expect(await run(['-s=probe', 'phone', 'time'], env)).toBe('Ran: await 폰시각(driver)\nTime: 2026-11-16T09:30:00+09:00');
    expect(await run(['-s=probe', 'phone', 'time', 'YYYY-MM-DD'], env)).toBe("Ran: await 폰시각(driver, 'YYYY-MM-DD')\nTime: 2026-11-16");
  });

  it('붙은 session 은 보기 · 시각은 되고 바꾸기는 --force — 모르는 할일은 던진다', async () => {
    await run(['-s=kit', 'attach', 'kit-7'], env);
    fetchMock.mockClear();
    await expect(run(['-s=kit', 'phone', 'network', 'off'], env)).rejects.toThrow('붙은 session 의 폰 상태를 바꾸면');
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(run(['-s=kit', 'phone', 'time'], env)).resolves.toMatch(/^Ran: await 폰시각/);
    await expect(run(['-s=probe', 'phone', 'wifi'], env)).rejects.toThrow('phone 은 인자 없이(보기)');
  });
});
