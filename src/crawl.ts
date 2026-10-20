// 앱을 스스로 눌러 가며 화면 키 · 화면 연결을 모은다 — test_platform scripts/authoring-crawl-state.ts 의 앱판(goto 대신 back · 재시작 + 경로 다시 누르기)

import { createHash } from 'node:crypto';

import { 가라앉기, 부른다, 요소를찾는다, 좌표를누른다, 화면을기다린다, type 연결 } from './appium.js';
import { center, locatorFor, w3c, type 요소, type 화면 } from './platform/android.js';
import { 로그인화면인가, 안누를까닭, 탈퇴말인가, 확인창, type 창결과 } from './press.js';

const 화면누름상한 = 30; // 버튼이 수백 개인 화면 하나가 시간을 다 먹지 않게 (test_platform 과 같다)

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
 * test_platform `screen_record.url` 칸에 그대로 들어가니 다음 실행에도 같은 화면이면 같은 값이어야 한다. F5-06 이 이것을 내보낸다.
 * name 은 컨테이너(없으면 화면 전체) 안 첫 TextView 글자 — 머리글 어림
 */
export function 화면을가린다(h: 화면, activity: string): 화면정보 {
  const els = Object.values(h.refs);
  const 틀 = 컨테이너(els);
  const structFp = 지문(h.글);
  const 밖 = 상자(틀?.bounds ?? '') ?? [0, 0, Infinity, Infinity];
  const 안 = (e: 요소): boolean => {
    const n = 상자(e.bounds);
    return n !== null && n[0]! >= 밖[0]! && n[1]! >= 밖[1]! && n[2]! <= 밖[2]! && n[3]! <= 밖[3]!;
  };
  const name = els.find((e) => e.cls === 'TextView' && e.text !== '' && 안(e))?.text ?? '';
  return { key: `app:${activity}/${틀 === undefined ? structFp : 틀.desc || 틀.id}`, name, structFp };
}

export interface 후보 {
  이름: string;
  el: 요소;
}

/**
 * 누를 후보 — 누를 수 있고 desc · id · 글자 중 하나가 있는 요소. 이름(desc → id → 글자)이 겹치면 앞 것만.
 * 안 누를 것(로그아웃 · 위험 글자 · --exclude)은 뺀다 — 탐색과 경로 다시 누르기가 같은 후보를 본다
 */
export function 후보들(h: 화면, 뺄: readonly RegExp[] = []): 후보[] {
  const 본 = new Map<string, 후보>();
  for (const el of Object.values(h.refs)) {
    const 이름 = el.desc || el.id || el.text;
    if (el.누름 && 이름 !== '' && !본.has(이름)) 본.set(이름, { 이름, el });
  }
  return [...본.values()].filter((x) => 안누를까닭(x.이름, 뺄) === null);
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

interface 지금 {
  화면: 화면;
  정보: 화면정보;
  앱: string;
}

async function 본다(c: 연결, sid: string, 앞?: string): Promise<지금> {
  const 화면 = await 화면을기다린다(c, sid, 앞);
  const activity = String(await 부른다(c, 'GET', `/session/${sid}/appium/device/current_activity`));
  const 앱 = String(await 부른다(c, 'GET', `/session/${sid}/appium/device/current_package`));
  return { 화면, 정보: 화면을가린다(화면, activity), 앱 };
}

export interface 본화면 extends 화면정보 {
  // 시작 화면에서 누른 후보 이름 차례 — 앱을 다시 띄운 뒤 이대로 다시 누른다
  path: string[];
  // 탈퇴 이름으로 왔거나 이름 · 키가 탈퇴다 — 이 화면에서는 아무것도 안 누른다
  탈퇴흐름?: true;
  // 아이디 칸 + 비밀번호 칸 — 다시 로그인은 F5-05 가 한다
  로그인풀림?: true;
}

export interface 크롤결과 {
  app: string;
  screens: 본화면[];
  links: { from: string; to: string; via: string }[];
  presses: number;
  restarts: number;
  // 누른 뒤 뜬 Android 확인 창을 어떻게 했나 — 누름(확인) · 탈퇴 · 경고 · 입력 · 남음(누를 버튼 없음)은 back
  dialogs: Partial<Record<창결과, number>>;
  stopped: string | null;
}

const 표 = (x: 지금, 탈퇴로: boolean): Pick<본화면, '탈퇴흐름' | '로그인풀림'> => ({
  ...(탈퇴로 || 탈퇴말인가(x.정보.name) || 탈퇴말인가(x.정보.key) ? { 탈퇴흐름: true } : {}),
  ...(로그인화면인가(Object.values(x.화면.refs)) ? { 로그인풀림: true } : {}),
});

/**
 * 지금 화면(시작 화면)부터 넓이 우선으로 돈다. 화면마다 후보를 하나씩 누르고, 새 화면이면 남긴 뒤 back 으로 돌아온다.
 * 못 돌아왔으면 다음 누르기 전에 앱을 다시 띄우고(terminateApp · activateApp) 그 화면의 path 를 다시 누른다. 다른 앱이 뜨면 back
 */
export async function crawl(c: 연결, sid: string, 상한: { 장: number; 분: number }, 뺄: readonly RegExp[] = []): Promise<크롤결과> {
  const 마감 = Date.now() + 상한.분 * 60_000;
  let 지금 = await 본다(c, sid);
  const app = 지금.앱;
  const r: 크롤결과 = { app, screens: [{ ...지금.정보, path: [], ...표(지금, false) }], links: [], presses: 0, restarts: 0, dialogs: {}, stopped: null };
  const 대기 = [...r.screens];

  // 누른 뒤 확인 창이 떴으면 확인 버튼 하나를 누르거나 back 으로 닫는다. 경로 다시 누르기에서는 세지 않는다
  const 창을닫는다 = async (탈퇴로: boolean, 셈: boolean): Promise<void> => {
    const 판 = 확인창(Object.values(지금.화면.refs), 탈퇴로);
    if (판 === null) return;
    if (셈) r.dialogs[판.결과] = (r.dialogs[판.결과] ?? 0) + 1;
    // 버튼이 그사이 사라져 못 누르면 back 으로 닫는다 — 창 하나 때문에 크롤 전체가 멈추지 않게
    const 버튼 = 판.버튼;
    const 눌렀다 = 버튼 !== undefined && (await 누른다(c, sid, 지금.화면, 버튼).then(() => true, () => false));
    if (!눌렀다) await 부른다(c, 'POST', `/session/${sid}/back`, {});
    지금 = await 본다(c, sid, 지금.화면.글);
  };

  const 되돌린다 = async (목표: 본화면): Promise<boolean> => {
    r.restarts++;
    for (const script of ['mobile: terminateApp', 'mobile: activateApp']) {
      await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script, args: [{ appId: app }] });
    }
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
  const 시간끝 = (): boolean => {
    if (Date.now() <= 마감) return false;
    r.stopped = `--minutes ${상한.분}`;
    return true;
  };

  for (let 목표 = 대기.shift(); 목표 !== undefined; 목표 = 대기.shift()) {
    if (시간끝()) return r;
    if (목표.탈퇴흐름) continue;
    // 못 가는 화면(경로 글자가 바뀌었다)은 건너뛴다
    if (지금.정보.key !== 목표.key && !(await 되돌린다(목표))) continue;
    for (const { 이름 } of 후보들(지금.화면, 뺄).slice(0, 화면누름상한)) {
      if (시간끝()) return r;
      if (지금.정보.key !== 목표.key && !(await 되돌린다(목표))) break;
      // 다시 띄운 뒤면 위치가 달라졌을 수 있어 지금 화면에서 다시 찾는다
      const x = 후보들(지금.화면, 뺄).find((h) => h.이름 === 이름);
      if (x === undefined) continue;
      const 앞 = 지금;
      await new Promise((ok) => setTimeout(ok, 가라앉기.간격_ms));
      try {
        await 누른다(c, sid, 앞.화면, x.el);
      } catch {
        continue; // 그사이 사라진 요소
      }
      r.presses++;
      지금 = await 본다(c, sid, 앞.화면.글);
      await 창을닫는다(탈퇴말인가(이름), true);
      const 뒤 = 지금.정보;
      if (지금.앱 === app && 뒤.key !== 목표.key) {
        r.links.push({ from: 목표.key, to: 뒤.key, via: `버튼 「${이름.slice(0, 60)}」` });
        if (!r.screens.some((s) => s.key === 뒤.key)) {
          if (r.screens.length >= 상한.장) {
            r.stopped = `--max ${상한.장}장`;
            return r;
          }
          const 새 = { ...뒤, path: [...목표.path, 이름], ...표(지금, 탈퇴말인가(이름)) };
          r.screens.push(새);
          대기.push(새);
        }
      }
      // 화면 안에서만 바뀐 누르기(창 · 펼치기)도 back 으로 닫는다. 구조가 그대로면 둔다
      if (지금.앱 !== app || 뒤.key !== 앞.정보.key || 뒤.structFp !== 앞.정보.structFp) {
        await 부른다(c, 'POST', `/session/${sid}/back`, {});
        지금 = await 본다(c, sid, 지금.화면.글);
      }
    }
  }
  return r;
}
