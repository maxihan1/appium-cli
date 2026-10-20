// 앱을 스스로 눌러 가며 화면 키 · 화면 연결을 모은다 — test_platform scripts/authoring-crawl-state.ts 의 앱판(goto 대신 back · 재시작 + 경로 다시 누르기)

import { createHash } from 'node:crypto';

import { logcat을읽는다, 가라앉기, 부른다, 요소를찾는다, 좌표를누른다, 화면을기다린다, type 연결 } from './appium.js';
import { 기록글, type 상태 } from './crawl-out.js';
import { apiLines } from './logcat.js';
import { center, locatorFor, w3c, type 요소, type 화면 } from './platform/android.js';
import { 로그인화면인가, 안누를까닭, 탈퇴말인가, 확인창, type 창결과 } from './press.js';

const 화면누름상한 = 30; // 버튼이 수백 개인 화면 하나가 시간을 다 먹지 않게 (test_platform 과 같다)
const API상한 = 200; // 화면 하나에서 — test_platform 서버 상한과 같다(PUT …/screens)
const 다시로그인상한 = 3; // 누를 때마다 로그아웃되는 앱에서 돌고 돌지 않게 (test_platform 과 같다)

/** 구조 지문 — test_platform `지문`(authoring-crawl-rules.ts)과 같다. 따옴표 안 글자 · 숫자를 빼고 짜임만 본다 */
export function 지문(글: string): string {
  const 정리 = 글
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/\d+/g, '0')
    .replace(/[ \t]+/g, ' ');
  return createHash('sha1').update(정리).digest('hex').slice(0, 12);
}

const 상자 = (bounds: string): number[] | null => /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(bounds)?.slice(1).map(Number) ?? null;

function 넓이(e: 요소): number {
  const n = 상자(e.bounds);
  return n === null ? 0 : (n[2]! - n[0]!) * (n[3]! - n[1]!);
}

// i 번째 요소의 자손 — 문서 차례로 뒤에 오고 그보다 깊은 요소가 이어지는 동안
function 자손(els: readonly 요소[], i: number): 요소[] {
  const 끝 = els.findIndex((e, j) => j > i && e.깊이 <= els[i]!.깊이);
  return els.slice(i + 1, 끝 < 0 ? els.length : 끝);
}

const 가장큰 = (els: 요소[]): 요소 | undefined => els.reduce<요소 | undefined>((a, e) => (a === undefined || 넓이(e) > 넓이(a) ? e : a), undefined);

/**
 * 본문 컨테이너 — 누르지 못하는 요소 가운데 desc 가 있는 가장 큰 것, 없으면 앱 resource-id(`android:id/…` 는 모든 앱에 있어 뺀다)가 있는 가장 큰 것.
 * 같은 넓이면 앞(바깥) 것. MDA 는 `desc="login screen"` 꼴이다(2026-10-20 실측)
 * ponytail: fragment 앱은 가장 큰 id 가 화면마다 같은 `nav_host` 일 수 있다 — 한 activity 의 화면이 한 키로 뭉치면 F5-05 실측 뒤 id 를 좁힌다
 */
function 컨테이너(els: 요소[]): 요소 | undefined {
  const 판 = els.filter((e) => !e.누름);
  return 가장큰(판.filter((e) => e.desc !== '')) ?? 가장큰(판.filter((e) => e.id !== '' && !e.id.startsWith('android:')));
}

export interface 화면정보 {
  key: string;
  name: string;
  structFp: string;
}

/**
 * 화면 키 `app:<activity>/<화면 이름표>` — 이름표는 본문 컨테이너의 desc → resource-id, 없으면 구조 지문.
 * 컨테이너 밑이 아닌 요소가 컨테이너 자리를 덮고 있으면(서랍 메뉴 · 앱 안 모달) 가운데가 컨테이너 안에 든 덮개의 첫 누를 것(desc → id)이 이름표다 — 어느 화면에서 열어도 같은 키.
 * test_platform `screen_record.url` 칸에 그대로 들어가니 다음 실행에도 같은 화면이면 같은 값이어야 한다. `src/index.ts` `screenKey` 가 이것을 내보낸다.
 * name 은 컨테이너(없으면 화면 전체 · 덮개면 덮개) 안 첫 TextView 글자 — 머리글 어림
 */
export function 화면을가린다(h: 화면, activity: string): 화면정보 {
  const els = Object.values(h.refs);
  const 틀 = 컨테이너(els);
  const structFp = 지문(h.글);
  const 밖 = 상자(틀?.bounds ?? '') ?? [0, 0, Infinity, Infinity];
  // 겉 상자가 안 상자를 품는가
  const 품음 = (겉: number[] | null, 안: number[] | null): boolean =>
    겉 !== null && 안 !== null && 안[0]! >= 겉[0]! && 안[1]! >= 겉[1]! && 안[2]! <= 겉[2]! && 안[3]! <= 겉[3]!;
  // 덮개 — 컨테이너 밑이 아닌데 컨테이너 자리에 가운데가 든 요소(서랍 메뉴 · 앱 안 모달). 뒤 화면이 트리에 그대로 남아 키가 뭉친다(MDA 서랍 2026-10-20 실측)
  // ponytail: 컨테이너와 겹치는 형제(떠 있는 버튼)도 덮개로 본다 — 그런 앱이 나오면 덮개를 누를 것이 여럿일 때로 좁힌다
  const 안쪽 = 틀 === undefined ? [] : 자손(els, els.indexOf(틀));
  const 덮개 = 틀 === undefined ? [] : els.filter((e) => {
    const p = center(e.bounds);
    return e !== 틀 && !안쪽.includes(e) && !품음(상자(e.bounds), 밖) && p !== null && 품음(밖, [p.x, p.y, p.x, p.y]);
  });
  const 덮개표 = 덮개.find((e) => e.누름 && (e.desc !== '' || e.id !== ''));
  const 볼것 = 덮개표 === undefined ? els.filter((e) => 품음(밖, 상자(e.bounds))) : 덮개;
  const name = 볼것.find((e) => e.cls === 'TextView' && e.text !== '')?.text ?? '';
  const 이름표 = 덮개표 !== undefined ? 덮개표.desc || 덮개표.id : 틀 === undefined ? structFp : 틀.desc || 틀.id;
  return { key: `app:${activity}/${이름표}`, name, structFp };
}

export interface 후보 {
  이름: string;
  el: 요소;
}

/**
 * 누를 후보 — 누를 수 있고 desc · id · 글자(없으면 자손의 첫 desc · 글자) 중 하나가 있는 요소. 이름이 겹치면 앞 것만.
 * 안 누를 것(로그아웃 · 위험 글자 · --exclude)은 뺀다 — 탐색과 경로 다시 누르기가 같은 후보를 본다.
 * 로그아웃누름 = 로그인 판에서 다시 로그인할 수 있을 때 — 로그아웃도 누른다(test_platform `누를까` 와 같다)
 */
export function 후보들(h: 화면, 뺄: readonly RegExp[] = [], 로그아웃누름 = false): 후보[] {
  const 본 = new Map<string, 후보>();
  const els = Object.values(h.refs);
  for (const [i, el] of els.entries()) {
    // 이름 없는 버튼은 자손의 첫 desc · 글자로 부른다 — MDA 상품 칸처럼 글자를 자식에만 가진 버튼(2026-10-20 실측)
    const 이름 = el.desc || el.id || el.text || (el.누름 ? (자손(els, i).map((e) => e.desc || e.text).find((x) => x !== '') ?? '') : '');
    if (el.누름 && 이름 !== '' && !본.has(이름)) 본.set(이름, { 이름, el });
  }
  return [...본.values()].filter((x) => {
    const 까닭 = 안누를까닭(x.이름, 뺄);
    return 까닭 === null || (로그아웃누름 && 까닭 === '로그아웃');
  });
}

// tap 과 같다 — 화면에 하나뿐인 선택자면 선택자로, 아니면 가운데 좌표
async function 누른다(c: 연결, sid: string, h: 화면, el: 요소): Promise<void> {
  const loc = locatorFor(el);
  if (loc !== null && Object.values(h.refs).filter((e) => locatorFor(e) === loc).length === 1) {
    const id = await 요소를찾는다(c, sid, w3c(loc).using, w3c(loc).value);
    await 부른다(c, 'POST', `/session/${sid}/element/${id}/click`, {});
    return;
  }
  const p = center(el.bounds);
  if (p === null) throw new Error('위치를 모른다');
  await 좌표를누른다(c, sid, p.x, p.y);
}

export interface 지금 {
  화면: 화면;
  정보: 화면정보;
  앱: string;
}

// screen 명령도 이것으로 본다 — 크롤이 남기는 키와 같은 값이어야 해서
export async function 본다(c: 연결, sid: string, 앞?: string): Promise<지금> {
  const 화면 = await 화면을기다린다(c, sid, 앞);
  const activity = String(await 부른다(c, 'GET', `/session/${sid}/appium/device/current_activity`));
  const 앱 = String(await 부른다(c, 'GET', `/session/${sid}/appium/device/current_package`));
  return { 화면, 정보: 화면을가린다(화면, activity), 앱 };
}

export interface 본화면 extends 화면정보 {
  상태: 상태;
  // 시작 화면에서 누른 후보 이름 차례 — 앱을 다시 띄운 뒤 이대로 다시 누른다
  path: string[];
  // 탈퇴 이름으로 왔거나 이름 · 키가 탈퇴다 — 이 화면에서는 아무것도 안 누른다
  탈퇴흐름?: true;
  // 아이디 칸 + 비밀번호 칸 — 로그인 판에서는 풀림으로 보고 다시 로그인한다(목록에서도 빠진다). 로그아웃 판에서는 표시만
  로그인풀림?: true;
  // 화면 파일 글(`# <키>` · 입력칸 줄 · 화면 글) — test_platform `record`
  record: string;
  // 이 화면으로 온 누르기 · 이 화면에서 누르기 전까지 logcat 에 찍힌 API (물음표 뒤는 지움)
  apis: { method: string; url: string }[];
}

export interface 크롤결과 {
  app: string;
  screens: 본화면[];
  links: { 상태: 상태; from: string; to: string; via: string }[];
  presses: number;
  restarts: number;
  // 로그인 판에서 로그인풀림 · 로그아웃 뒤 다시 로그인한 수 (처음 로그인은 안 센다)
  다시로그인: number;
  // 로그인 앞에 앱을 어떻게 비웠나 — 팜이 clearApp 을 막으면 terminateApp 으로 끄기만 한다
  앱비우기?: 'mobile: clearApp' | 'mobile: terminateApp';
  // 누른 뒤 뜬 Android 확인 창을 어떻게 했나 — 누름(확인) · 탈퇴 · 경고 · 입력 · 남음(누를 버튼 없음)은 back
  dialogs: Partial<Record<창결과, number>>;
  stopped: string | null;
  // 끝까지 돈 상태 — 에이전트가 저장본에서 못 본 화면을 지울지 본다
  상태들: 상태[];
  // 도중에 던진 오류 — 본 것까지는 남긴다
  예외?: string;
}

const 남길화면 = (x: 지금, path: string[], 탈퇴로: boolean, 상태: 상태): 본화면 => ({
  상태,
  ...x.정보,
  path,
  ...(탈퇴로 || 탈퇴말인가(x.정보.name) || 탈퇴말인가(x.정보.key) ? { 탈퇴흐름: true } : {}),
  ...(로그인화면인가(Object.values(x.화면.refs)) ? { 로그인풀림: true } : {}),
  record: 기록글(x.정보.key, x.화면),
  apis: [],
});

export interface 로그인방법 {
  역할: string;
  // 로그인 스크립트를 돌린다 — 앱을 비우고 띄운 뒤 부르고, 끝나면 앱 첫 화면(로그인한)이어야 한다
  돌린다: () => Promise<void>;
}

/**
 * 지금 화면(시작 화면)부터 넓이 우선으로 돈다. 화면마다 후보를 하나씩 누르고, 새 화면이면 남긴 뒤 back 으로 돌아온다.
 * 못 돌아왔으면 다음 누르기 전에 앱을 다시 띄우고(terminateApp · activateApp) 그 화면의 path 를 다시 누른다. 다른 앱이 뜨면 back.
 * API 는 시작할 때 쌓인 logcat 을 버리고, 누르기 바로 전에 읽은 줄은 지금 화면 몫, 누른 뒤 읽은 줄은 간 화면(안 바뀌었으면 지금 화면) 몫이다.
 * 로그인이 있으면 로그아웃 판을 돈 뒤 앱을 비우고(clearApp) 로그인해 로그인 판을 돈다 — 장수 · 시간은 판마다 나눈다(test_platform 몫).
 * 로그인 판에서 로그인 화면이 뜨면 다시 로그인해 그 버튼을 한 번 더 누르고, 또 뜨면 로그인 칸이 있는 화면으로 남긴다. 로그아웃은 다시 로그인할 수 있을 때만 누른다
 */
export async function crawl(
  c: 연결,
  sid: string,
  상한: { 장: number; 분: number },
  뺄: readonly RegExp[] = [],
  API꼴?: RegExp,
  로그인?: 로그인방법,
): Promise<크롤결과> {
  const 시작 = Date.now();
  let 지금 = await 본다(c, sid);
  const app = 지금.앱;
  const 상태들: 상태[] = 로그인 === undefined ? ['로그아웃'] : ['로그아웃', `로그인:${로그인.역할}`];
  const r: 크롤결과 = { app, screens: [], links: [], presses: 0, restarts: 0, 다시로그인: 0, dialogs: {}, stopped: null, 상태들: [] };

  // logcat 을 못 읽는 서버(권한 · 로컬 Appium)면 API 없이 돈다
  const API봄 = await logcat을읽는다(c, sid).then(() => true, () => false);
  const API모은다 = async (상태: 상태, key: string): Promise<void> => {
    if (!API봄) return;
    const 줄 = await logcat을읽는다(c, sid).catch((): string[] => []);
    const s = r.screens.find((x) => x.상태 === 상태 && x.key === key);
    for (const { method, url } of apiLines(줄, API꼴)) {
      if (s !== undefined && s.apis.length < API상한 && !s.apis.some((a) => a.method === method && a.url === url)) s.apis.push({ method, url });
    }
  };

  // 누른 뒤 확인 창이 떴으면 확인 버튼 하나를 누르거나 back 으로 닫는다 — 창이 이어 뜨면(확인 뒤 「됐다」 창) 세 개까지. 경로 다시 누르기에서는 세지 않는다
  const 창을닫는다 = async (탈퇴로: boolean, 셈: boolean): Promise<void> => {
    for (let n = 0; n < 3; n++) {
      const 판 = 확인창(Object.values(지금.화면.refs), 탈퇴로);
      if (판 === null) return;
      if (셈) r.dialogs[판.결과] = (r.dialogs[판.결과] ?? 0) + 1;
      // 버튼이 그사이 사라져 못 누르면 back 으로 닫는다 — 창 하나 때문에 크롤 전체가 멈추지 않게
      const 버튼 = 판.버튼;
      const 눌렀다 = 버튼 !== undefined && (await 누른다(c, sid, 지금.화면, 버튼).then(() => true, () => false));
      if (!눌렀다) await 부른다(c, 'POST', `/session/${sid}/back`, {});
      지금 = await 본다(c, sid, 지금.화면.글);
    }
  };

  const 앱에 = (script: string): Promise<unknown> => 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script, args: [{ appId: app }] });

  const 되돌린다 = async (목표: 본화면): Promise<boolean> => {
    r.restarts++;
    await 앱에('mobile: terminateApp');
    await 앱에('mobile: activateApp');
    지금 = await 본다(c, sid, 지금.화면.글);
    for (const 이름 of 목표.path) {
      const x = 후보들(지금.화면, 뺄).find((h) => h.이름 === 이름);
      if (x === undefined) return false;
      if (!(await 누른다(c, sid, 지금.화면, x.el).then(() => true, () => false))) return false;
      지금 = await 본다(c, sid, 지금.화면.글);
      await 창을닫는다(false, false);
    }
    return 지금.정보.key === 목표.key;
  };

  // 앱 데이터를 지우고(팜이 막으면 앱만 끄고) 띄운 뒤 로그인 스크립트. 로그인하며 찍힌 API 는 어느 화면 몫도 아니라 버린다
  const 로그인한다 = async (로그인: 로그인방법): Promise<void> => {
    r.앱비우기 = await 앱에('mobile: clearApp').then(
      () => 'mobile: clearApp' as const,
      async () => {
        await 앱에('mobile: terminateApp');
        return 'mobile: terminateApp' as const;
      },
    );
    await 앱에('mobile: activateApp');
    await 로그인.돌린다();
    지금 = await 본다(c, sid);
    if (API봄) await logcat을읽는다(c, sid).catch(() => []);
    if (로그인화면인가(Object.values(지금.화면.refs))) throw new Error('로그인 스크립트를 돌린 뒤에도 로그인 화면이다 — --login 스크립트를 본다');
  };

  // 판 하나 — 몫(장 · 마감)을 다 쓰면 다음 판으로, 로그인이 풀려 다시 못 하면 false(그만)
  const 한판 = async (상태: 상태, 몫: { 장: number; 마감: number }): Promise<boolean> => {
    const 판이름 = (말: string): string => (상태들.length === 1 ? 말 : `${상태} 몫 · ${말}`);
    const 첫 = 남길화면(지금, [], false, 상태);
    r.screens.push(첫);
    const 대기 = [첫];
    // 로그인 판에서 로그인 화면으로 간 버튼 — 다시 로그인한 뒤 한 번 더 눌렀는지
    const 다시본 = new Set<string>();
    const 로그인남음 = (): boolean => 로그인 !== undefined && 상태 !== '로그아웃' && r.다시로그인 < 다시로그인상한;
    const 다시로그인 = async (): Promise<boolean> => {
      if (!로그인남음()) return false;
      r.다시로그인++;
      await 로그인한다(로그인!);
      return true;
    };
    const 시간끝 = (): boolean => {
      if (Date.now() <= 몫.마감) return false;
      r.stopped ??= 판이름(`--minutes ${상한.분}`);
      return true;
    };

    for (let 목표 = 대기.shift(); 목표 !== undefined; 목표 = 대기.shift()) {
      if (시간끝()) return true;
      if (목표.탈퇴흐름) continue;
      // 못 가는 화면(경로 글자가 바뀌었다)은 건너뛴다
      if (지금.정보.key !== 목표.key && !(await 되돌린다(목표))) continue;
      const 이름들 = 후보들(지금.화면, 뺄, 로그인남음()).slice(0, 화면누름상한).map((x) => x.이름);
      for (let i = 0; i < 이름들.length; i++) {
        const 이름 = 이름들[i]!;
        if (시간끝()) return true;
        if (지금.정보.key !== 목표.key && !(await 되돌린다(목표))) break;
        // 다시 띄운 뒤면 위치가 달라졌을 수 있어 지금 화면에서 다시 찾는다. 다시 로그인을 다 썼으면 로그아웃은 여기서 빠진다
        const x = 후보들(지금.화면, 뺄, 로그인남음()).find((h) => h.이름 === 이름);
        if (x === undefined) continue;
        const 로그아웃 = 안누를까닭(이름) === '로그아웃';
        const 앞 = 지금;
        await new Promise((ok) => setTimeout(ok, 가라앉기.간격_ms));
        await API모은다(상태, 목표.key); // back · 다시 띄우기로 이 화면에 오며 찍힌 것
        try {
          await 누른다(c, sid, 앞.화면, x.el);
        } catch {
          continue; // 그사이 사라진 요소
        }
        r.presses++;
        지금 = await 본다(c, sid, 앞.화면.글);
        await 창을닫는다(탈퇴말인가(이름), true);
        const 뒤 = 지금.정보;
        const 간곳 = 지금.앱 === app ? 뒤.key : 목표.key;
        const 풀림 = 상태 !== '로그아웃' && !로그아웃 && 지금.앱 === app && 로그인화면인가(Object.values(지금.화면.refs));
        if (풀림 && !다시본.has(`${목표.key} ${이름}`)) {
          다시본.add(`${목표.key} ${이름}`);
          if (!(await 다시로그인())) {
            r.stopped ??= '로그인이 풀림';
            return false;
          }
          i--; // 같은 버튼을 한 번 더 — 또 로그인 화면이면 로그인 칸이 있는 화면이다
          continue;
        }
        if (지금.앱 === app && 뒤.key !== 목표.key) {
          r.links.push({ 상태, from: 목표.key, to: 뒤.key, via: `버튼 「${이름.slice(0, 60)}」` });
          // 로그아웃으로 간 화면은 남기지 않는다(test_platform 과 같다)
          if (!로그아웃 && !r.screens.some((s) => s.상태 === 상태 && s.key === 뒤.key)) {
            if (r.screens.filter((s) => s.상태 === 상태).length >= 몫.장) {
              r.stopped ??= 판이름(`--max ${상한.장}장`);
              return true;
            }
            const 새 = 남길화면(지금, [...목표.path, 이름], 탈퇴말인가(이름), 상태);
            r.screens.push(새);
            // 로그인 판의 로그인 칸 화면은 남기기만 하고 안 돈다
            if (!풀림) 대기.push(새);
          }
        }
        await API모은다(상태, 간곳);
        // 다시 로그인하면 앱 첫 화면이다 — back 하지 않는다
        if (로그아웃 && (await 다시로그인())) continue;
        // 화면 안에서만 바뀐 누르기(창 · 펼치기)도 back 으로 닫는다. 구조가 그대로면 둔다
        if (지금.앱 !== app || 뒤.key !== 앞.정보.key || 뒤.structFp !== 앞.정보.structFp) {
          await 부른다(c, 'POST', `/session/${sid}/back`, {});
          지금 = await 본다(c, sid, 지금.화면.글);
        }
      }
    }
    return true;
  };

  // 도중에 죽어도(session 끊김) 본 것까지는 남기게 오류를 결과에 싣는다
  try {
    for (const [i, 상태] of 상태들.entries()) {
      // 앞 판이 덜 쓴 장수는 뒤로 넘긴다
      const 몫 = { 장: Math.floor((상한.장 - r.screens.length) / (상태들.length - i)), 마감: 시작 + ((i + 1) * 상한.분 * 60_000) / 상태들.length };
      if (상태 !== '로그아웃') await 로그인한다(로그인!);
      const 계속 = await 한판(상태, 몫);
      r.상태들.push(상태);
      if (!계속) break;
    }
  } catch (e) {
    r.예외 = e instanceof Error ? e.message : String(e);
  }
  return r;
}
