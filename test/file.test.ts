// 폰 파일 명령 — 넣기 · 폴더 보기 · 지우기가 kit 과 같은 요청을 보내고 Ran 줄 · 지울 명령을 내는지 fetch 가짜로 본다

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

let 폴더: Record<string, string[]> = {};
let 셸막힘 = false;

beforeEach(async () => {
  Object.assign(가라앉기, { 최대_ms: 0, 간격_ms: 0, 찾기_ms: 10_000 });
  process.chdir(mkdtempSync(join(tmpdir(), 'appium-cli-')));
  폴더 = { "'/sdcard/Download'": ['receipt.pdf', '영수증 1.pdf'] };
  셸막힘 = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace('http://farm:4723/wd/hub', '');
    const body = init.body === undefined ? undefined : (JSON.parse(init.body as string) as { script?: string; args?: { command?: string; args?: string[] }[] });
    if (path === '/session') return 답({ sessionId: 's-1', capabilities: { appPackage: 'com.shop' } });
    if (path.endsWith('/source')) return 답(화면XML);
    if (body?.script === 'mobile: shell') {
      if (셸막힘) return 답({ error: 'unknown error', message: 'adb_shell 이 꺼져 있다' }, 500);
      const { command, args = [] } = body.args![0]!;
      if (command === 'ls') {
        const 있음 = 폴더[args[1]!];
        return 있음 === undefined ? 답({ error: 'unknown error', message: `ls: ${args[1]}: No such file or directory` }, 500) : 답(`${있음.join('\n')}\n`);
      }
      return 답('');
    }
    return 답(init.method === 'DELETE' ? null : {});
  });
  vi.stubGlobal('fetch', fetchMock);
  await run(['-s=probe', 'open'], env);
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const 보낸것 = (): [string, unknown][] =>
  (fetchMock.mock.calls as [string, RequestInit][]).map(([u, i]) => [u.replace('http://farm:4723/wd/hub/session/s-1', ''), i.body === undefined ? undefined : JSON.parse(i.body as string)]);

describe('file', () => {
  it('push 는 kit 과 같은 폴더 · qa- 이름으로 넣고 미디어 훑기를 부른 뒤 Ran 줄 · 지울 명령을 낸다', async () => {
    const out = await run(['-s=probe', 'file', 'push', '사진'], env);
    const [[푸시, 몸], [훑기, 훑기몸]] = 보낸것() as [[string, { path: string; data: string }], [string, unknown]];
    expect(푸시).toBe('/appium/device/push_file');
    expect(몸.path).toMatch(/^\/sdcard\/Pictures\/qa-[a-z0-9]+-[a-z0-9]+\.png$/);
    expect(Buffer.from(몸.data, 'base64').subarray(1, 4).toString()).toBe('PNG');
    expect(훑기).toBe('/execute/sync');
    expect(훑기몸).toEqual({ script: 'mobile: scanMedia', args: [{ remotePath: 몸.path }] });
    expect(out.split('\n')).toEqual([
      "Ran: const 파일 = await 폰에파일넣기(driver, '사진')",
      '// 케이스는 finally 에서 await 파일.지우기() — 고르기 화면에서는 파일.이름 으로 고른다',
      `File: ${몸.path}`,
      `- 탐색이 끝나면 지운다: file rm ${몸.path}`,
    ]);
  });

  it('push --size 는 작게 보내고 폰 안에서 늘린다 — 셸이 막히면 넣은 것을 지우려 하고 까닭을 붙여 던진다', async () => {
    const out = await run(['-s=probe', 'file', 'push', '영상', '--size', String(99 * 1024 * 1024)], env);
    expect(out.split('\n')[0]).toBe("Ran: const 파일 = await 폰에파일넣기(driver, '영상', { 크기: 103809024 })");
    const 셸들 = 보낸것().filter(([p]) => p === '/execute/sync').map(([, b]) => (b as { args: unknown[] }).args[0]);
    expect(셸들[0]).toEqual({ command: 'truncate', args: ['-s', '103809024', expect.stringMatching(/^\/sdcard\/Movies\/qa-.+\.mp4$/)] });
    셸막힘 = true;
    await expect(run(['-s=probe', 'file', 'push', '영상', '--size', '2000000'], env)).rejects.toThrow('바이트로 못 늘렸다(폰 셸');
    fetchMock.mockClear();
    for (const 틀림 of ['10', '1.5', 'big']) await expect(run(['-s=probe', 'file', 'push', '사진', '--size', 틀림], env)).rejects.toThrow('--size 는');
    await expect(run(['-s=probe', 'file', 'push', '문서'], env)).rejects.toThrow('file push 는 사진 · 영상 · 파일');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ls 는 폴더를 작은따옴표로 싸서 읽는다 — 이름을 주면 폰파일있나 Ran 줄과 있나만', async () => {
    expect(await run(['-s=probe', 'file', 'ls', '/sdcard/Download'], env)).toBe('receipt.pdf\n영수증 1.pdf');
    expect(보낸것()[0]![1]).toEqual({ script: 'mobile: shell', args: [{ command: 'ls', args: ['-1', "'/sdcard/Download'"] }] });
    expect(await run(['-s=probe', 'file', 'ls', '/sdcard/Download', '영수증 1.pdf'], env)).toBe("Ran: await 폰파일있나(driver, '/sdcard/Download', '영수증 1.pdf')\nExists: true");
    expect(await run(['-s=probe', 'file', 'ls', '/sdcard/Download', 'receipt'], env)).toMatch(/\nExists: false$/);
  });

  it('ls 는 없는 폴더를 빈 것으로 · 셸이 막히면 까닭을 붙여 던진다 · 상대 경로는 안 보낸다', async () => {
    expect(await run(['-s=probe', 'file', 'ls', '/sdcard/Android/data/com.shop/files'], env)).toBe('/sdcard/Android/data/com.shop/files 가 비었거나 없다');
    expect(await run(['-s=probe', 'file', 'ls', '/sdcard/없는곳', 'a.pdf'], env)).toMatch(/\nExists: false$/);
    셸막힘 = true;
    await expect(run(['-s=probe', 'file', 'ls', '/sdcard/Download'], env)).rejects.toThrow('/sdcard/Download 를 못 읽었다(폰 셸 — adb_shell 이 닫혔으면 못 쓴다)');
    fetchMock.mockClear();
    await expect(run(['-s=probe', 'file', 'ls', 'Download'], env)).rejects.toThrow('절대 경로');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rm 은 넣은 파일(세 폴더의 qa- 이름)만 지운다 — 폰에 원래 있던 파일은 안 보낸다', async () => {
    expect(await run(['-s=probe', 'file', 'rm', '/sdcard/Download/qa-abc-1x2y.txt'], env)).toBe('지웠다: /sdcard/Download/qa-abc-1x2y.txt');
    expect(보낸것()[0]![1]).toEqual({ script: 'mobile: shell', args: [{ command: 'rm', args: ['-f', '/sdcard/Download/qa-abc-1x2y.txt'] }] });
    fetchMock.mockClear();
    for (const 틀림 of ['/sdcard/Download/receipt.pdf', '/sdcard/DCIM/qa-a.png', '/sdcard/Download/qa-a.txt; rm -rf /sdcard', '/sdcard/Download/../qa-a.txt'])
      await expect(run(['-s=probe', 'file', 'rm', 틀림], env)).rejects.toThrow('file rm 은');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('붙은 session 은 ls 는 되고 넣기 · 지우기는 --force — 모르는 할일은 던진다', async () => {
    await run(['-s=kit', 'attach', 'kit-7'], env);
    fetchMock.mockClear();
    await expect(run(['-s=kit', 'file', 'push', '사진'], env)).rejects.toThrow('붙은 session 의 폰에 파일을');
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(run(['-s=kit', 'file', 'ls', '/sdcard/Download', 'receipt.pdf'], env)).resolves.toMatch(/Exists: true$/);
    await expect(run(['-s=probe', 'file', 'pull'], env)).rejects.toThrow('file 은 push · ls · rm');
  });
});
