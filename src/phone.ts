// 폰 상태 명령의 몸 — 화면 방향 · 네트워크 · 가짜 위치 · 어두운 화면 · 글자 크기를 보고 바꾸고, 폰 시각을 읽는다. cli.ts 는 인자를 읽고 여기를 부르기만 한다
// 요청은 test_platform kit `폰상태에서` · `폰시각` 과 같다 — 탐색에서 본 것이 케이스에서도 그대로 일어나야 한다

import { 부른다, type 연결 } from './appium.js';

const 까닭 = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const 실행 = (c: 연결, sid: string, script: string, arg: Record<string, unknown> = {}): Promise<unknown> => 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script, args: [arg] });

// 디바이스 팜이 막은 명령은 조용히 넘기지 않고 무엇을 못 했는지 붙여 던진다 — 안 바뀐 상태로 본 화면을 바뀐 화면으로 읽지 않게
async function 막히면<값>(무엇: string, 일: () => Promise<값>): Promise<값> {
  try {
    return await 일();
  } catch (e) {
    throw new Error(`${무엇} — ${까닭(e)}`);
  }
}

const 글자크기읽기 = async (c: 연결, sid: string): Promise<string> =>
  String(await 실행(c, sid, 'mobile: shell', { command: 'settings', args: ['get', 'system', 'font_scale'] })).trim();

/** 지금 폰 상태 — 한 줄에 하나. 읽기가 막힌 줄은 모름과 까닭 */
export async function 폰상태(c: 연결, sid: string): Promise<string> {
  const 줄 = async (이름: string, 읽기: () => Promise<string>): Promise<string> => `- ${이름}: ${await 읽기().catch((e: unknown) => `모름(${까닭(e)})`)}`;
  return (
    await Promise.all([
      줄('방향', async () => ((await 부른다(c, 'GET', `/session/${sid}/orientation`)) === 'LANDSCAPE' ? '가로' : '세로')),
      줄('네트워크', async () => {
        const v = (await 실행(c, sid, 'mobile: getConnectivity', { services: ['wifi', 'data'] })) as { wifi?: boolean; data?: boolean };
        return `와이파이 ${v.wifi === true ? '켬' : '끔'} · 모바일 데이터 ${v.data === true ? '켬' : '끔'}`;
      }),
      줄('어두운 화면', async () => ((await 실행(c, sid, 'mobile: getUiMode', { mode: 'night' })) === 'yes' ? '켬' : '끔')),
      // 한 번도 안 바꾼 폰은 null 이다 — 기본(1)
      줄('글자 크기', async () => {
        const v = await 글자크기읽기(c, sid);
        return v === 'null' || v === '' ? '1' : v;
      }),
      줄('시각', async () => String(await 실행(c, sid, 'mobile: getDeviceTime'))),
    ])
  ).join('\n');
}

export type 방향 = 'landscape' | 'portrait';
export const 방향인가 = (x: string | undefined): x is 방향 => x === 'landscape' || x === 'portrait';

/** 바꾼 결과 — Ran 은 케이스에 쓸 구간 꼴, 앞 · 되돌리기는 탐색이 끝나면 칠 명령 */
export interface 바꿈 {
  Ran: string;
  앞: string;
  되돌리기: string | null;
}

const 구간 = (값: string): string => `// 케이스에서는 구간으로 쓴다 — await 폰상태에서(driver, { ${값} }, async () => { … })`;
const 구간끝 = '// 케이스에서는 폰상태에서 구간이 끝나면 kit 이 되돌린다';

export async function 돌린다(c: 연결, sid: string, 어디로: 방향): Promise<바꿈> {
  const 앞 = (await 막히면('화면 방향을 못 읽었다', () => 부른다(c, 'GET', `/session/${sid}/orientation`))) === 'LANDSCAPE' ? 'landscape' : 'portrait';
  await 막히면('화면을 못 돌렸다', () => 부른다(c, 'POST', `/session/${sid}/orientation`, { orientation: 어디로.toUpperCase() }));
  return {
    Ran: 구간(`방향: '${어디로 === 'landscape' ? '가로' : '세로'}'`),
    앞: `Was: 방향 ${앞 === 'landscape' ? '가로' : '세로'}`,
    되돌리기: 앞 === 어디로 ? null : `phone rotate ${앞}`,
  };
}

/** off 는 켜져 있던 것만 끈다 — 모바일 데이터가 없는 폰(SIM 없음)에 데이터 끄기를 보내지 않게. on 은 둘 다 켠다 */
export async function 네트워크(c: 연결, sid: string, 켤까: boolean): Promise<바꿈> {
  const 앞 = (await 막히면('네트워크 상태를 못 읽었다', () => 실행(c, sid, 'mobile: getConnectivity', { services: ['wifi', 'data'] }))) as { wifi?: boolean; data?: boolean };
  const 켜진 = (['wifi', 'data'] as const).filter((k) => 앞[k] === true);
  const 바꿀 = 켤까 ? { wifi: true, data: true } : Object.fromEntries(켜진.map((k) => [k, false]));
  if (Object.keys(바꿀).length > 0) await 막히면(`네트워크를 못 ${켤까 ? '켰다' : '끊었다'}`, () => 실행(c, sid, 'mobile: setConnectivity', 바꿀));
  return {
    Ran: 켤까 ? 구간끝 : 구간("네트워크: '끊김'"),
    앞: `Was: 와이파이 ${앞.wifi === true ? '켬' : '끔'} · 모바일 데이터 ${앞.data === true ? '켬' : '끔'}`,
    되돌리기: !켤까 && 켜진.length > 0 ? 'phone network on' : null,
  };
}

export async function 위치(c: 연결, sid: string, 곳: { 위도: number; 경도: number } | 'reset'): Promise<바꿈> {
  if (곳 === 'reset') {
    await 막히면('가짜 위치를 못 거뒀다', () => 실행(c, sid, 'mobile: resetGeolocation'));
    return { Ran: 구간끝, 앞: 'Was: 가짜 위치(있었다면)', 되돌리기: null };
  }
  await 막히면('위치를 못 바꿨다', () => 실행(c, sid, 'mobile: setGeolocation', { latitude: 곳.위도, longitude: 곳.경도 }));
  return { Ran: 구간(`위치: { 위도: ${곳.위도}, 경도: ${곳.경도} }`), 앞: 'Was: 진짜 위치', 되돌리기: 'phone location reset' };
}

export async function 어두운화면(c: 연결, sid: string, 켤까: boolean): Promise<바꿈> {
  const 앞 = await 막히면('어두운 화면 설정을 못 읽었다', () => 실행(c, sid, 'mobile: getUiMode', { mode: 'night' }));
  await 막히면('어두운 화면을 못 바꿨다', () => 실행(c, sid, 'mobile: setUiMode', { mode: 'night', value: 켤까 ? 'yes' : 'no' }));
  const 앞켬 = 앞 === 'yes';
  return { Ran: 구간(`어두운화면: ${켤까}`), 앞: `Was: 어두운 화면 ${String(앞)}`, 되돌리기: 앞켬 === 켤까 ? null : `phone dark ${앞켬 ? 'on' : 'off'}` };
}

/** 글자 크기는 폰 셸로만 바뀐다 — 팜이 adb_shell 을 닫았으면 그 까닭을 붙여 던진다 */
export async function 글자크기(c: 연결, sid: string, 배율: number): Promise<바꿈> {
  const 앞 = await 막히면('글자 크기를 못 읽었다(폰 셸 — adb_shell 이 닫혔으면 못 쓴다)', () => 글자크기읽기(c, sid));
  await 막히면('글자 크기를 못 바꿨다(폰 셸 — adb_shell 이 닫혔으면 못 쓴다)', () => 실행(c, sid, 'mobile: shell', { command: 'settings', args: ['put', 'system', 'font_scale', String(배율)] }));
  const 앞값 = 앞 === 'null' || 앞 === '' ? '1' : 앞;
  return { Ran: 구간(`글자크기: ${배율}`), 앞: `Was: 글자 크기 ${앞값}`, 되돌리기: Number(앞값) === 배율 ? null : `phone font ${앞값}` };
}

/** 폰 시각 — 꼴은 moment 꼴(기본 YYYY-MM-DDTHH:mm:ssZ). 폰 시간대 기준이다 */
export async function 폰시각(c: 연결, sid: string, 꼴?: string): Promise<string> {
  return String(await 막히면('폰 시각을 못 읽었다', () => 실행(c, sid, 'mobile: getDeviceTime', 꼴 === undefined ? {} : { format: 꼴 })));
}
