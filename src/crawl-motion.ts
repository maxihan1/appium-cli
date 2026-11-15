// 화면마다 「어떻게 움직이나」(계속 움직임 · 앱 밖 · 굴림 · 같은 id · 잠깐 뜸 · 확인 창)를 화면 파일 머리 줄로 만드는 순수 판정 — test_platform scripts/authoring-crawl-motion.ts 의 앱판

import type { 요소, 화면 } from './platform/android.js';

const 줄상한 = 20; // 화면 하나가 머리 줄로 파일을 덮지 않게
const 잠깐상한 = 3;
const 잠깐글자 = 40;
const 같은id상한 = 5;
const 굴림밀면 = ' — 밀면 새 줄이 보인다';

const 정리 = (글: string, 길이: number): string => 글.replace(/\s+/g, ' ').trim().slice(0, 길이);

/** 같은 줄은 한 번만, 화면 하나에 20줄까지 */
export function 줄더하기(줄들: string[], 줄: string): void {
  if (줄들.length < 줄상한 && !줄들.includes(줄)) 줄들.push(줄);
}

const 굴림줄 = (목록: 요소): string => `# 굴림: 목록 「${목록.desc || 목록.id || '이름 없음'}」`;

/** 목록을 밀어 새 누를 것이 보였으면 굴림 줄 끝에 그 말을 붙인다 — 줄을 둘 만들지 않는다 */
export function 밀림표시(줄들: string[], 목록: 요소 | undefined): void {
  if (목록 === undefined) return;
  const 줄 = 굴림줄(목록);
  const i = 줄들.findIndex((x) => x === 줄 || x === 줄 + 굴림밀면);
  if (i >= 0) 줄들[i] = 줄 + 굴림밀면;
  else 줄더하기(줄들, 줄 + 굴림밀면);
}

/** 한 화면에 같은 resource-id 가 두 번 넘게 나오면 많은 차례로 5개까지 — 목록 줄이 되풀이되는 id. `android:` id 는 모든 앱에 있어 뺀다 */
export function 같은id줄(els: readonly 요소[]): string | null {
  const 셈 = new Map<string, number>();
  for (const e of els) if (e.id !== '' && !e.id.startsWith('android:')) 셈.set(e.id, (셈.get(e.id) ?? 0) + 1);
  const 많은 = [...셈].filter(([, n]) => n > 2).sort((a, b) => b[1] - a[1]).slice(0, 같은id상한);
  return 많은.length === 0 ? null : `# 같은 id: ${많은.map(([id, n]) => `id=${id} ${n}개`).join(' · ')}`;
}

/** 화면을 처음 남길 때 붙는 줄 — 계속 움직임 · 굴림 · 같은 id. 초 = 기다린 최대 시간 */
export function 처음줄들(h: 화면, 목록: 요소 | undefined, 초: number): string[] {
  const 줄들: string[] = [];
  if (h.기다림?.계속) 줄더하기(줄들, `# 계속 움직임: 누른 뒤 기다리는 동안(최대 ${초}초) 화면 글이 멈추지 않았다 — 기다릴 때 움직이는화면에서 를 쓴다`);
  if (목록 !== undefined) 줄더하기(줄들, 굴림줄(목록));
  const 같은 = 같은id줄(Object.values(h.refs));
  if (같은 !== null) 줄더하기(줄들, 같은);
  return 줄들;
}

/**
 * 누른 뒤 기다리는 동안 잠깐 뜬 글 — Toast 요소와 Material 스낵바(`…/snackbar_text`)의 글. 앞 화면 글에 이미 있던 것은 지난 것이라 뺀다.
 * 중간 읽기에만 있던 글은 고르지 않는다 — 반쯤 그린 화면 · 「불러오는 중」 자리 글이 잠깐 뜸으로 잡혀 없는 기다림을 만든다
 */
export function 잠깐뜬글(읽음: readonly 화면[], 앞글: string): string[] {
  const 앞에있음 = (글: string): boolean => 앞글.includes(`text=${JSON.stringify(글)}`);
  const 뜬것 = 읽음.flatMap((h) =>
    Object.values(h.refs)
      .filter((e) => !e.비밀번호 && e.text.trim() !== '' && (e.cls === 'Toast' || e.id.endsWith('snackbar_text')))
      .map((e) => e.text),
  );
  return [...new Set(뜬것.filter((t) => !앞에있음(t)).map((t) => 정리(t, 잠깐글자)))].slice(0, 잠깐상한);
}

/** Android 확인 창의 제목 · 본문 글(`android:id/alertTitle` · `android:id/message`) — 둘 다 없으면 null */
export function 창글(els: readonly 요소[]): string | null {
  const 글 = ['android:id/alertTitle', 'android:id/message']
    .map((id) => 정리(els.find((e) => e.id === id)?.text ?? '', 60))
    .filter((x) => x !== '');
  return 글.length === 0 ? null : 글.join(' / ');
}

/** 화면 파일 글의 첫 줄(`# <키>`) 바로 뒤에 머리 줄을 끼운다 — 글자 지문은 끼우기 전 글로 재니 지문은 흔들리지 않는다 */
export function 머리줄끼우기(파일글: string, 줄들: readonly string[]): string {
  if (줄들.length === 0) return 파일글;
  const 첫끝 = 파일글.indexOf('\n');
  return 첫끝 < 0 ? [파일글, ...줄들].join('\n') : `${파일글.slice(0, 첫끝)}\n${줄들.join('\n')}${파일글.slice(첫끝)}`;
}
