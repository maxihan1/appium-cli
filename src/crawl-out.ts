// crawl 결과를 test_platform 크롤러 출력 꼴(화면 파일 · list · index · links · apis · summary)로 바꾸고 저장본과 견준다 — scripts/authoring-crawl.ts `남기기` · authoring-screens-keep.ts 의 앱판

import { createHash } from 'node:crypto';

import type { 크롤결과 } from './crawl.js';
import type { 화면 } from './platform/android.js';
import { 입력칸인가 } from './press.js';

/** test_platform `상태`(authoring-screens-keep.ts) · DB CHECK 와 같은 꼴 — 로그인 판은 F5-05 */
export type 상태 = '로그아웃' | `로그인:${string}`;
const 상태인가 = (v: unknown): v is 상태 => v === '로그아웃' || (typeof v === 'string' && /^로그인:\S(?:.{0,38}\S)?$/su.test(v));

/**
 * 화면 파일 글 — 머리 `# <화면 키>`, 입력칸 줄(test_platform `칸줄` 꼴), 화면 글. 이것이 test_platform `record` 이고 글자지문 재료다.
 * 앱 입력칸은 종류 password · text, 이름 desc → id, enabled=false 면 읽기 전용. 필수 · 글자 수 · 형식은 Android 화면 글에 없다
 */
export function 기록글(key: string, h: 화면): string {
  const 칸 = Object.values(h.refs)
    .filter(입력칸인가)
    .map((e) => `# 입력칸: ${e.비밀번호 ? 'password' : 'text'} ${e.desc || e.id}${e.꺼짐 ? ' · 읽기 전용' : ''}`);
  return [`# ${key}`, ...칸, h.글, ''].join('\n');
}

/** 글자 지문 — test_platform `글자지문`(authoring-crawl-rules.ts)과 같다. 본문 숫자(좌표 · ref 번호 · 개수)는 0 으로, `#` 머리 줄은 숫자까지 본다 */
export function 글자지문(파일글: string): string {
  const 정리 = 파일글
    .split('\n')
    .map((줄) => (줄.startsWith('#') ? 줄 : 줄.replace(/\d+/g, '0')).replace(/[ \t]+/g, ' '))
    .join('\n');
  return createHash('sha1').update(정리).digest('hex').slice(0, 12);
}

/** test_platform `저장항목` — 에이전트가 화면 기록에서 만든 저장본(`kept/index.json`)을 그대로 받는다 */
export interface 저장항목 {
  키: string;
  상태: 상태;
  틀: string;
  주소: string;
  지문: string;
  글자지문: string;
  기록: string;
  훑은날: string;
}

export interface 저장본 {
  판: 1;
  항목: 저장항목[];
}

/** 이 날수를 넘은 기록은 바뀐 것으로 본다 — test_platform `다시훑는날수` 와 같다 */
const 다시훑는날수 = 30;

/** test_platform `저장본모양` 과 같다 — 틀린 항목은 빼고, 판이 다르면 빈 저장본 */
export function 저장본모양(값: unknown): 저장본 {
  const 빈것: 저장본 = { 판: 1, 항목: [] };
  if (typeof 값 !== 'object' || 값 === null) return 빈것;
  const v = 값 as { 판?: unknown; 항목?: unknown };
  if (v.판 !== 1 || !Array.isArray(v.항목)) return 빈것;
  const 글 = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length < 2_000;
  const 항목 = v.항목.filter((x): x is 저장항목 => {
    if (typeof x !== 'object' || x === null) return false;
    const h = x as Record<string, unknown>;
    return (
      글(h.키) && 상태인가(h.상태) && 글(h.틀) && 글(h.주소) && 글(h.지문) && 글(h.글자지문) &&
      typeof h.기록 === 'string' && /^(?:in|out)-[0-9a-f]{12}\.md$/.test(h.기록) && typeof h.훑은날 === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.훑은날)
    );
  });
  return { 판: 1, 항목 };
}

type 표시 = { 저장본: '같음' | '바뀜' | '새 화면'; 저장기록?: string };

/**
 * test_platform `견주기` — 글자 지문까지 같고 30일 안이면 같음(저장 기록을 그대로 쓴다). 표시 키는 `<상태> <틀>`.
 * 번호로 묶인 상세(틀에 `:n`)를 구조 지문으로 보는 갈래는 뺐다 — 앱 화면 키에는 번호 틀이 없다
 */
export function 견주기(
  목록: readonly { 상태: 상태; 틀: string; 글자지문: string }[],
  저장: 저장본,
  오늘: string,
): { 표시: Map<string, 표시>; 못본: 저장항목[] } {
  const 저장키 = new Map(저장.항목.map((x) => [x.키, x]));
  const 표시 = new Map<string, 표시>();
  for (const x of 목록) {
    const 키 = `${x.상태} ${x.틀}`;
    const 옛 = 저장키.get(키);
    if (옛 === undefined) 표시.set(키, { 저장본: '새 화면' });
    else if (옛.글자지문 === x.글자지문 && Date.parse(오늘) - Date.parse(옛.훑은날) <= 다시훑는날수 * 86_400_000) 표시.set(키, { 저장본: '같음', 저장기록: 옛.기록 });
    else 표시.set(키, { 저장본: '바뀜' });
  }
  return { 표시, 못본: 저장.항목.filter((x) => !표시.has(x.키)) };
}

/**
 * 결과 폴더에 쓸 파일(상대 경로 → 글)과 요약 줄의 저장본 조각. 칸 이름은 test_platform 크롤러 출력과 같고 화면 키가 그쪽 주소 · 틀 자리에 든다.
 * 화면 파일은 `<상태 폴더>/NNN.yml` — 글은 YAML 이 아니지만 test_platform `이번것들` 이 `NNN.yml` 로 기록 번호를 맞춘다
 */
export function 결과파일들(r: 크롤결과, 상태: 상태, 저장: 저장본 | null, 오늘: string): { 파일들: Map<string, string>; 저장본: string } {
  const 폴더 = 상태 === '로그아웃' ? '로그아웃' : '로그인';
  const 화면들 = r.screens.map((s, i) => ({ ...s, 상태, 파일: `${폴더}/${String(i + 1).padStart(3, '0')}.yml`, textFp: 글자지문(s.record) }));
  const 견줌 = 저장 === null ? null : 견주기(화면들.map((s) => ({ 상태, 틀: s.key, 글자지문: s.textFp })), 저장, 오늘);
  const 목록 = 화면들.map((s) => ({
    주소: s.key, 이름: s.name, 상태, 파일: s.파일, 틀: s.key, 지문: s.structFp, 글자지문: s.textFp, ...견줌?.표시.get(`${상태} ${s.key}`),
  }));
  // 화면 연결 — 같은 곳 · 같은 버튼은 하나로, 남긴 화면에서 나간 것만
  const 연결 = 화면들.flatMap((s) => {
    const 칸 = new Map(r.links.filter((l) => l.from === s.key).map((l) => [`${l.to} ${l.via}`, { to: l.to, via: l.via }]));
    return 칸.size === 0 ? [] : [{ 상태, 틀: s.key, 연결: [...칸.values()] }];
  });
  const 파일들 = new Map<string, string>(화면들.map((s) => [s.파일, s.record]));
  // 화면 글은 화면 파일에 있으니 index 에는 안 싣는다
  파일들.set('index.json', JSON.stringify({ ...r, screens: 화면들.map(({ record: _, ...s }) => s) }, null, 1));
  파일들.set('list.json', JSON.stringify(목록, null, 1));
  파일들.set('links.json', JSON.stringify(연결));
  파일들.set('apis.json', JSON.stringify(화면들.map((s) => ({ 상태, 틀: s.key, api: s.apis }))));
  // 에이전트가 저장본에서 못 본 화면을 지울지 본다 — 도중에 죽었으면 그 상태는 다 돈 것이 아니다
  파일들.set('summary.json', JSON.stringify({ 멈춘까닭: r.stopped, 상태들: r.예외 === undefined ? [상태] : [], 예외: r.예외 !== undefined }));
  const 셈 = (x: 표시['저장본']): number => 목록.filter((m) => m.저장본 === x).length;
  return {
    파일들,
    저장본: 견줌 === null ? '저장본 없음' : `저장본 같음 ${셈('같음')} · 바뀜 ${셈('바뀜')} · 새 화면 ${셈('새 화면')} · 저장본에 있는데 못 본 화면 ${견줌.못본.length}`,
  };
}
