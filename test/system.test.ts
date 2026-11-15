// 시스템 화면 · 다른 앱 명령 — 권한 보기 · 주기 · 빼기, 권한 창 단추의 Ran 줄, 알림 창, 앱 다시 앞에 두기, 앞 앱 줄을 fetch 가짜로 본다

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { 가라앉기 } from '../src/appium.js';
import { run } from '../src/cli.js';
import { 네이티브명령 } from '../src/web.js';

import { 화면XML } from './fixture.js';

const fetchMock = vi.fn();
const env = { PLATFORM_APPIUM_URL: 'http://farm:4723/wd/hub', PLATFORM_APP: '/apk/dev.apk' };
const 답 = (value: unknown, status = 200): Response => new Response(JSON.stringify({ value }), { status });
const 크롬XML = `<hierarchy width="1080" height="2400"><android.widget.Button package="com.android.chrome" text="계속" clickable="true" bounds="[0,0][9,9]" resource-id="com.android.chrome:id/ok" /></hierarchy>`;

let 화면 = 화면XML;
let 줌 = ['android.permission.POST_NOTIFICATIONS'];
let 바꾸기막힘 = false;
// 막혔을 때도 이 이름들까지는 바뀐다 — 여러 권한을 차례로 바꾸다 도중에 실패한 꼴
let 막히기전 = [] as string[];

beforeEach(async () => {
  Object.assign(가라앉기, { 최대_ms: 0, 간격_ms: 0, 찾기_ms: 10_000 });
  process.chdir(mkdtempSync(join(tmpdir(), 'appium-cli-')));
  화면 = 화면XML;
  줌 = ['android.permission.POST_NOTIFICATIONS'];
  바꾸기막힘 = false;
  막히기전 = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace('http://farm:4723/wd/hub', '');
    const body = init.body === undefined ? undefined : (JSON.parse(init.body as string) as { script?: string; args?: { type?: string; permissions?: string[]; action?: string }[] });
    if (path === '/session') return 답({ sessionId: 's-1', capabilities: { appPackage: 'com.shop' } });
    if (path.endsWith('/source')) return 답(화면);
    if (path.endsWith('/element')) return 답({ 'element-6066-11e4-a52e-4f735466cecf': 'el-9' });
    if (path.endsWith('/current_package')) return 답('com.android.chrome');
    if (body?.script === 'mobile: getPermissions') return 답(body.args?.[0]?.type === 'requested' ? ['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS'] : 줌);
    if (body?.script === 'mobile: changePermissions') {
      const { permissions = [], action } = body.args![0]!;
      const 바꿀 = 바꾸기막힘 ? 막히기전 : permissions.filter((p) => p !== 'android.permission.INTERNET');
      줌 = action === 'grant' ? [...new Set([...줌, ...바꿀])] : 줌.filter((p) => !바꿀.includes(p));
      if (바꾸기막힘) return 답({ error: 'unknown error', message: 'pm 이 막혔다' }, 500);
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

const 실행들 = (): unknown[] =>
  (fetchMock.mock.calls as [string, RequestInit][]).filter(([u]) => u.endsWith('/execute/sync')).map(([, i]) => JSON.parse(i.body as string) as unknown);
const 바꾸기 = (): unknown[] => 실행들().filter((x) => (x as { script: string }).script === 'mobile: changePermissions');

describe('permission', () => {
  it('인자가 없으면 앱이 요청한 권한마다 줌 · 안 줌을 낸다', async () => {
    expect(await run(['-s=probe', 'permission'], env)).toBe('- android.permission.CAMERA 안 줌\n- android.permission.POST_NOTIFICATIONS 줌');
    expect(바꾸기()).toEqual([]);
  });

  it('grant 는 줄인 이름도 받아 시험 대상 앱에 주고, 케이스 구간 꼴 · 앞 상태 · 되돌릴 명령을 낸다 — 앱은 안 건드린다', async () => {
    const out = await run(['-s=probe', 'permission', 'grant', 'CAMERA', 'android.permission.POST_NOTIFICATIONS'], env);

    expect(바꾸기()).toEqual([
      { script: 'mobile: changePermissions', args: [{ permissions: ['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS'], appPackage: 'com.shop', action: 'grant' }] },
    ]);
    expect(out.split('\n')).toEqual([
      "Ran: // 케이스에서는 구간으로 쓴다 — await 권한상태에서(driver, { 준다: ['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS'] }, async () => { … })",
      'Was: android.permission.CAMERA 안 줌',
      'Was: android.permission.POST_NOTIFICATIONS 줌',
      '- 탐색이 끝나면 되돌린다: permission revoke android.permission.CAMERA',
    ]);
    expect(실행들()).toHaveLength(3);
  });

  it('줄인 이름은 대문자로 맞추고, 바꿔도 안 바뀐 권한(늘 주는 권한)은 되돌릴 명령에 안 넣는다', async () => {
    const out = await run(['-s=probe', 'permission', 'grant', 'camera', 'INTERNET'], env);

    expect(out).toContain("{ 준다: ['android.permission.CAMERA', 'android.permission.INTERNET'] }");
    expect(out).toContain('- 탐색이 끝나면 되돌린다: permission revoke android.permission.CAMERA');
  });

  it('준 권한을 revoke 하면 꺼진 앱을 다시 띄우고 새 화면을 찍는다', async () => {
    const out = await run(['-s=probe', 'permission', 'revoke', 'POST_NOTIFICATIONS', 'CAMERA'], env);

    expect(실행들().at(-1)).toEqual({ script: 'mobile: activateApp', args: [{ appId: 'com.shop' }] });
    expect(out).toContain("{ 뺀다: ['android.permission.POST_NOTIFICATIONS', 'android.permission.CAMERA'] }");
    expect(out).toContain('- 탐색이 끝나면 되돌린다: permission grant android.permission.POST_NOTIFICATIONS\n- 권한을 빼서 꺼진 앱을 다시 띄웠다\n- Snapshot: ');
  });

  it('안 준 권한만 revoke 하면 바뀐 것이 없어 앱을 다시 띄우지 않는다', async () => {
    const out = await run(['-s=probe', 'permission', 'revoke', 'CAMERA'], env);

    expect(out).not.toContain('되돌린다');
    expect(실행들().map((x) => (x as { script: string }).script)).toEqual(['mobile: getPermissions', 'mobile: changePermissions', 'mobile: getPermissions']);
  });

  it('팜이 막으면 어떤 권한을 못 바꿨는지 실어 던진다', async () => {
    바꾸기막힘 = true;
    await expect(run(['-s=probe', 'permission', 'grant', 'CAMERA'], env)).rejects.toThrow('권한을 못 줬다(android.permission.CAMERA) — Appium 이 HTTP 500 로 답했다: pm 이 막혔다\nWas: android.permission.CAMERA 안 줌');
  });

  it('여러 권한을 빼다 도중에 막혀도 이미 뺀 것의 되돌릴 명령을 싣고, 꺼진 앱을 다시 띄운 뒤 던진다', async () => {
    바꾸기막힘 = true;
    막히기전 = ['android.permission.POST_NOTIFICATIONS'];

    const 던짐 = run(['-s=probe', 'permission', 'revoke', 'POST_NOTIFICATIONS', 'CAMERA'], env);

    await expect(던짐).rejects.toThrow('- 탐색이 끝나면 되돌린다: permission grant android.permission.POST_NOTIFICATIONS\n- 권한을 빼서 꺼진 앱을 다시 띄웠다');
    expect(실행들().at(-1)).toEqual({ script: 'mobile: activateApp', args: [{ appId: 'com.shop' }] });
  });

  it('다시 띄울 수 없는 intent 인자면 권한을 빼기 전에 던진다', async () => {
    await run(['-s=probe', 'close'], env);
    await run(['-s=probe', 'open', '--cap', 'appium:appActivity=.Main', '--cap', 'appium:optionalIntentArguments=--activity-clear-top'], env);
    fetchMock.mockClear();

    await expect(run(['-s=probe', 'permission', 'revoke', 'POST_NOTIFICATIONS'], env)).rejects.toThrow('mobile: startActivity extras 로 못 옮긴다');
    expect(바꾸기()).toEqual([]);
  });

  it('꼴이 틀리면 거절하고, 붙은 session 은 시험 대상 앱을 몰라 거절한다', async () => {
    await expect(run(['-s=probe', 'permission', 'grant'], env)).rejects.toThrow('permission 은 인자 없이(보기)');
    await expect(run(['-s=probe', 'permission', 'allow', 'CAMERA'], env)).rejects.toThrow('permission 은 인자 없이(보기)');
    await run(['-s=kit', 'attach', 'kit-7'], env);
    await expect(run(['-s=kit', 'permission'], env)).rejects.toThrow('시험 대상 앱 꾸러미를 모른다');
    expect(바꾸기()).toEqual([]);
  });

  it('웹 맥락에서는 permission · notifications 를 막는다', () => {
    expect(네이티브명령.has('permission')).toBe(true);
    expect(네이티브명령.has('notifications')).toBe(true);
  });
});

describe('권한 창 · 알림 창 · 다른 앱', () => {
  it('권한 창의 허용 · 거부 단추를 누르면 Ran 줄은 kit 권한창답하기 다', async () => {
    expect(await run(['-s=probe', 'tap', 'id=com.android.permissioncontroller:id/permission_allow_foreground_only_button'], env)).toMatch(/^Ran: await 권한창답하기\(driver, '허용'\)\n/);
    expect(await run(['-s=probe', 'tap', 'id=com.android.permissioncontroller:id/permission_deny_button'], env)).toMatch(/^Ran: await 권한창답하기\(driver, '거부'\)\n/);
    expect(await run(['-s=probe', 'tap', 'id=com.android.permissioncontroller:id/permission_allow_one_time_button'], env)).toMatch(
      /^Ran: await 권한창답하기\(driver, '허용'\)\n- 케이스의 권한창답하기 는 「앱 사용 중에만 허용」이 보이면 그것을 먼저 누른다/,
    );
    expect(await run(['-s=probe', 'tap', 'id=com.shop:id/pw'], env)).toMatch(/^Ran: await driver\.\$\('id=com\.shop:id\/pw'\)\.click\(\)\n/);
  });

  it('notifications 는 알림 창을 내리고 kit 알림창열기 줄과 새 화면을 낸다', async () => {
    const out = await run(['-s=probe', 'notifications'], env);

    expect(실행들()).toEqual([{ script: 'mobile: openNotifications', args: [{}] }]);
    expect(out).toMatch(/^Ran: await 알림창열기\(driver\)\n- Snapshot: /);
  });

  it('다른 앱이 앞이면 화면 끝에 앞 앱 줄이 붙고, app front 는 지금 앱이 아니라 시험 대상 앱을 앞에 둔다', async () => {
    화면 = 크롬XML;
    expect(await run(['-s=probe', 'snapshot'], env)).toMatch(/\n- 앞 앱: com\.android\.chrome — 시험 대상 앱\(com\.shop\)이 아니다\. 다 보면 app front 로 돌아온다$/);

    화면 = 화면XML.replace('resource-id="com.shop:id/root"', 'package="com.shop" resource-id="com.shop:id/root"');
    const out = await run(['-s=probe', 'app', 'front'], env);

    expect(실행들()).toEqual([{ script: 'mobile: activateApp', args: [{ appId: 'com.shop' }] }]);
    expect(out).toMatch(/^Ran: await driver\.activateApp\('com\.shop'\)\n- Snapshot: [^\n]+$/);
  });

  it('맨 위 덮개 하나가 다른 꾸러미여도 요소가 많은 시험 대상 앱이면 앞 앱 줄을 안 붙인다', async () => {
    화면 = `<hierarchy width="1080" height="2400"><android.widget.Button package="com.google.android.gms" text="계정" clickable="true" bounds="[0,0][9,9]" resource-id="" /><android.widget.Button package="com.shop" text="가" clickable="true" bounds="[0,10][9,19]" resource-id="" /><android.widget.Button package="com.shop" text="나" clickable="true" bounds="[0,20][9,29]" resource-id="" /></hierarchy>`;
    expect(await run(['-s=probe', 'snapshot'], env)).not.toContain('앞 앱');
  });

  it('붙은 session 의 app front 는 시험 대상 앱을 몰라 바로 거절하고, notifications 는 --force 없이 거절한다', async () => {
    await run(['-s=kit', 'attach', 'kit-7'], env);
    fetchMock.mockClear();
    await expect(run(['-s=kit', 'app', 'front'], env)).rejects.toThrow('시험 대상 앱 꾸러미를 모른다');
    await expect(run(['-s=kit', 'notifications'], env)).rejects.toThrow('알림 창을 내리면 케이스가 쓰는 앱 위를 덮는다');
    expect(실행들()).toEqual([]);
  });
});
