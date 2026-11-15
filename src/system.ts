// 시스템 화면 · 다른 앱 명령의 몸 — 권한 보기 · 주기 · 빼기, 권한 창 단추를 kit 부품 줄로, 앞에 온 다른 앱 알리기. cli.ts 는 인자를 읽고 여기를 부르기만 한다

import { 부른다, type 연결 } from './appium.js';
import type { 요소 } from './platform/android.js';

const 까닭 = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const 실행 = (c: 연결, sid: string, script: string, arg: Record<string, unknown>): Promise<unknown> => 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script, args: [arg] });

/** `CAMERA` 처럼 줄인 이름에 android.permission. 을 붙인다 — Ran 줄 · 케이스에는 늘 온 이름을 싣는다 */
export const 권한이름 = (x: string): string => (x.includes('.') ? x : `android.permission.${x.toUpperCase()}`);

const 준권한 = async (c: 연결, sid: string, 꾸러미: string): Promise<Set<string>> =>
  new Set(((await 실행(c, sid, 'mobile: getPermissions', { type: 'granted', appPackage: 꾸러미 })) ?? []) as string[]);

/** 앱이 요청한 권한마다 준 것인지 — 한 줄에 하나 */
export async function 권한목록(c: 연결, sid: string, 꾸러미: string): Promise<string> {
  const [요청, 줌] = await Promise.all([실행(c, sid, 'mobile: getPermissions', { type: 'requested', appPackage: 꾸러미 }).then((v) => (v ?? []) as string[]), 준권한(c, sid, 꾸러미)]);
  if (요청.length === 0) return `${꾸러미} 이 요청한 권한이 없다`;
  return 요청.map((p) => `- ${p} ${줌.has(p) ? '줌' : '안 줌'}`).join('\n');
}

/**
 * 시험 대상 앱의 권한을 창 없이 주거나 뺀다(케이스의 `권한상태에서` 와 같은 `mobile: changePermissions`).
 * 바꾼 뒤 다시 읽어 실제로 바뀐 것만 되돌리는 명령(없으면 null)으로 낸다 — 늘 주는 권한 · pm 이 넘긴 이름 · 도중에 실패한 여러 권한도 맞게.
 * 바꾸기가 실패해도 던지지 않고 까닭(실패)을 돌려준다 — 부른 쪽이 앞 상태 · 되돌릴 명령을 낸 뒤 던진다. 빼면 Android 가 앱을 끈다 — 다시 띄우기는 부른 쪽이 한다
 */
export async function 권한바꾼다(c: 연결, sid: string, 꾸러미: string, 줄까: boolean, 이름들: string[]): Promise<{ 앞: string[]; 되돌리기: string | null; 실패?: string }> {
  const 줌 = await 준권한(c, sid, 꾸러미);
  let 실패: string | undefined;
  try {
    await 실행(c, sid, 'mobile: changePermissions', { permissions: 이름들, appPackage: 꾸러미, action: 줄까 ? 'grant' : 'revoke' });
  } catch (e) {
    실패 = `권한을 ${줄까 ? '못 줬다' : '못 뺐다'}(${이름들.join(' · ')}) — ${까닭(e)}`;
  }
  const 뒤 = await 준권한(c, sid, 꾸러미);
  const 바뀐 = 이름들.filter((p) => 줌.has(p) !== 뒤.has(p));
  return {
    앞: 이름들.map((p) => `Was: ${p} ${줌.has(p) ? '줌' : '안 줌'}`),
    되돌리기: 바뀐.length === 0 ? null : `permission ${줄까 ? 'revoke' : 'grant'} ${바뀐.join(' ')}`,
    ...(실패 === undefined ? {} : { 실패 }),
  };
}

// kit `권한창답하기` 가 찾는 단추와 같다 — 꾸러미가 둘인 것은 안드로이드 9 까지가 packageinstaller 라서다
const 권한주소 = (이름: string): string[] => [`id=com.android.permissioncontroller:id/${이름}`, `id=com.android.packageinstaller:id/${이름}`];
const 허용단추 = new Set(['permission_allow_button', 'permission_allow_foreground_only_button', 'permission_allow_one_time_button'].flatMap(권한주소));
const 거부단추 = new Set(['permission_deny_button', 'permission_deny_and_dont_ask_again_button'].flatMap(권한주소));

/** 권한 창 단추면 kit 부품 답 — 케이스는 그 단추를 직접 누르지 않고 `권한창답하기` 를 쓴다 */
export const 권한창답 = (선택자: string): '허용' | '거부' | undefined => (허용단추.has(선택자) ? '허용' : 거부단추.has(선택자) ? '거부' : undefined);

/** kit 은 보이는 단추를 허용 → 앱 사용 중에만 → 이번만 차례로 고른다 — 이번만 허용을 누른 탐색은 케이스와 다른 단추일 수 있어 알린다 */
export const 권한창알림 = (선택자: string): string | null =>
  /permission_allow_one_time_button$/.test(선택자) ? '- 케이스의 권한창답하기 는 「앱 사용 중에만 허용」이 보이면 그것을 먼저 누른다 — 이번만 허용과 다르다' : null;

/** 마지막 화면이 시험 대상 앱이 아니면 한 줄 — 권한 창 · 알림 창 · 공유 창 · 고르개 · 다른 앱(Chrome · 소셜 로그인 · 결제) */
export function 앞앱줄(refs: Record<string, 요소>, 꾸러미: string | undefined): string | null {
  if (꾸러미 === undefined) return null;
  // 가장 많은 요소의 꾸러미 — 맨 위 덮개 하나(키보드 · 로그인 창)로 화면 전체를 다른 앱으로 보지 않게
  const 셈 = new Map<string, number>();
  for (const e of Object.values(refs)) if (e.속성?.package !== undefined) 셈.set(e.속성.package, (셈.get(e.속성.package) ?? 0) + 1);
  const 앞 = [...셈].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (앞 === undefined || 앞 === 꾸러미) return null;
  return `- 앞 앱: ${앞} — 시험 대상 앱(${꾸러미})이 아니다. 다 보면 app front 로 돌아온다`;
}
