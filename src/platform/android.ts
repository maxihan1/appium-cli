// Android(UiAutomator2) 화면 XML 을 ref 붙은 짧은 글로 줄이고, 요소마다 test_platform 규칙의 locator 를 고른다

export interface 요소 {
  cls: string;
  text: string;
  desc: string;
  id: string;
  bounds: string;
  누름: boolean;
  // 비밀번호 칸 — 글자는 싣지 않지만 로그인 화면을 가리는 데 쓴다
  비밀번호: boolean;
  // enabled=false — 화면 파일 입력칸 줄의 「읽기 전용」
  꺼짐: boolean;
}

export interface 화면 {
  글: string;
  refs: Record<string, 요소>;
  width: number;
  height: number;
}

// filter 는 디바이스 팜이 폰을 고르는 조건이다(`os>=13,model=SM-*` — 쉼표는 AND). 팜은 Appium 으로 넘기지 않는다
export function capabilities(app: string, udid?: string, filter?: string): Record<string, unknown> {
  return {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:app': app,
    // 기본 60초면 AI 가 다음 명령을 고르는 사이 session 이 끊긴다
    'appium:newCommandTimeout': 300,
    ...(udid ? { 'appium:udid': udid } : {}),
    ...(filter ? { 'farm:filter': filter } : {}),
  };
}

const 글자뜻: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function 풀기(v: string): string {
  return v.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith('#')) return String.fromCodePoint(Number(e.slice(1)));
    return 글자뜻[e] ?? m;
  });
}

// 속성 값 안에는 `>` 가 그대로 올 수 있어 따옴표 짝을 보고 태그 끝을 찾는다
const 태그 = /<(\/?)([^\s/>]+)((?:\s+[^\s=]+="[^"]*")*)\s*(\/?)>/g;
const 속성 = /([^\s=]+)="([^"]*)"/g;

/**
 * test_platform runner `화면을줄인다`(apps/runner/src/appScreen.ts)와 같은 줄 형식에 `[ref=eN]` 을 붙인다.
 * 이름표도 글자도 id 도 없고 누르지도 못하는 껍데기 요소는 줄을 빼되, 자식 들여쓰기는 남은 조상 기준으로 맞춘다
 */
export function parseSource(xml: string): 화면 {
  const 줄: string[] = [];
  const 조상: boolean[] = [];
  const refs: Record<string, 요소> = {};
  let width = 0;
  let height = 0;
  for (const m of xml.matchAll(태그)) {
    const [, 닫음, 이름, 속성글, 홀로] = m;
    if (닫음 === '/') {
      조상.pop();
      continue;
    }
    const a: Record<string, string> = {};
    for (const p of (속성글 ?? '').matchAll(속성)) a[p[1]!] = 풀기(p[2]!);
    if (이름 === 'hierarchy') {
      width = Number(a.width ?? 0);
      height = Number(a.height ?? 0);
      continue;
    }
    if (이름!.startsWith('?')) continue;
    // 비밀번호 칸은 가려진 글자라도 값으로 보이는 것을 싣지 않는다
    const 글 = a.password === 'true' ? '' : (a.text ?? '');
    const 이름표 = a['content-desc'] ?? '';
    const id = a['resource-id'] ?? '';
    const 누름 = a.clickable === 'true' || a['long-clickable'] === 'true';
    const 남김 = 글 !== '' || 이름표 !== '' || id !== '' || 누름 || a.scrollable === 'true';
    if (남김) {
      const ref = `e${Object.keys(refs).length + 1}`;
      const cls = 이름!.split('.').pop()!;
      refs[ref] = { cls, text: 글, desc: 이름표, id, bounds: a.bounds ?? '', 누름, 비밀번호: a.password === 'true', 꺼짐: a.enabled === 'false' };
      const 칸 = [cls];
      if (글 !== '') 칸.push(`text=${JSON.stringify(글)}`);
      if (이름표 !== '') 칸.push(`desc=${JSON.stringify(이름표)}`);
      if (id !== '') 칸.push(`id=${id}`);
      if (누름) 칸.push('클릭');
      if (a.scrollable === 'true') 칸.push('스크롤');
      if (a.checked === 'true') 칸.push('체크됨');
      if (a.enabled === 'false') 칸.push('꺼짐');
      칸.push(a.bounds ?? '', `[ref=${ref}]`);
      줄.push(`${'  '.repeat(조상.filter(Boolean).length)}${칸.join(' ')}`);
    }
    if (홀로 !== '/') 조상.push(남김);
  }
  const 머리 = `화면 ${width || '?'}x${height || '?'} · 요소 ${Object.keys(refs).length}개`;
  return { 글: [머리, ...줄].join('\n'), refs, width, height };
}

/** webdriverio 선택자. 이름표(accessibility id) → resource-id 순이고, 글자(text=)로는 고르지 않는다 */
export function locatorFor(el: 요소): string | null {
  if (el.desc !== '') return `~${el.desc}`;
  if (el.id !== '') return `id=${el.id}`;
  return null;
}

/** 선택자를 W3C find element 의 using · value 로 바꾼다 */
export function w3c(locator: string): { using: string; value: string } {
  if (locator.startsWith('~')) return { using: 'accessibility id', value: locator.slice(1) };
  return { using: 'id', value: locator.slice('id='.length) };
}

/** `[x1,y1][x2,y2]` 의 가운데 */
export function center(bounds: string): { x: number; y: number } | null {
  const n = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(bounds)?.slice(1).map(Number);
  if (n === undefined) return null;
  return { x: Math.round((n[0]! + n[2]!) / 2), y: Math.round((n[1]! + n[3]!) / 2) };
}
