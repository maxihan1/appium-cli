// 앱 안 웹 화면(웹뷰) 맥락 — 맥락 목록 · 웹 화면 읽기 · 웹 선택자를 W3C 찾기로 바꾸기. cli.ts 는 웹 맥락일 때 여기를 부른다

import { 부른다, 요소번호, type 연결 } from './appium.js';

/** 웹 화면 줄의 ref — 네이티브(eN)와 섞이지 않게 w 를 붙인다 */
export const 웹ref인가 = (x: string | undefined): x is string => x !== undefined && /^w\d+$/.test(x);

/** 웹 화면을 찍을 때 요소마다 다는 표 — 주소 없는 ref 를 누르고 count 가 맞은 요소의 ref 를 읽는 데 쓴다 */
export const 표이름 = 'data-appium-cli-ref';

export interface 웹요소 {
  // 웹 케이스 순서로 고른 WebdriverIO 선택자. 없으면 까닭
  loc: string | null;
  까닭?: string;
}

export async function 맥락들(c: 연결, sid: string): Promise<{ 목록: string[]; 지금: string }> {
  const [목록, 지금] = await Promise.all([부른다(c, 'GET', `/session/${sid}/contexts`), 부른다(c, 'GET', `/session/${sid}/context`)]);
  return { 목록: Array.isArray(목록) ? 목록.map(String) : [], 지금: String(지금) };
}

/**
 * WebdriverIO 가 `aria/<이름>` · `<태그>=<글>` 을 classic 연결에서 바꾸는 XPath(getAriaXPathSelector · xpath extended 부분 아님)와 같은 식을 짓는다.
 * 같은 XPath 라야 CLI 가 센 수와 케이스가 찾는 것이 맞는다. 웹 화면 읽기도 페이지 안에서 이 글을 그대로 써서 한 벌만 둔다(함수를 toString 하면 빌드 도구가 이름을 바꾼다).
 * `<태그>=<글>` 은 글에 큰따옴표가 있으면 WebdriverIO 가 깨진 식을 지어 쓰지 않는다
 */
const 식글 = `
const xpath글 = (v) => !v.includes('"') ? '"' + v + '"' : !v.includes("'") ? "'" + v + "'"
  : 'concat(' + v.split('"').flatMap((조각, i) => [...(i > 0 ? ["'\\"'"] : []), ...(조각 === '' ? [] : ['"' + 조각 + '"'])]).join(', ') + ')';
const aria식 = (이름) => {
  const e = xpath글(이름);
  return [
    './/*[@aria-labelledby=(//*[normalize-space(text()) = ' + e + ']/@id)]',
    './/*[@aria-describedby=(//*[normalize-space(text()) = ' + e + ']/@id)]',
    './/*[@aria-label = ' + e + ']',
    './/input[@id = (//label[normalize-space() = ' + e + ']/@for)]',
    './/textarea[@id = (//label[normalize-space() = ' + e + ']/@for)]',
    './/input[ancestor::label[normalize-space(text()) = ' + e + ']]',
    './/textarea[ancestor::label[normalize-space(text()) = ' + e + ']]',
    './/input[@placeholder=' + e + ']',
    './/textarea[@placeholder=' + e + ']',
    './/input[@aria-placeholder=' + e + ']',
    './/textarea[@aria-placeholder=' + e + ']',
    './/*[not(self::label)][@title=' + e + ']',
    './/img[@alt=' + e + ']',
    './/*[not(self::label)][normalize-space(text()) = ' + e + ']',
  ].join(' | ');
};
const 태그글식 = (태그, 글) => {
  const 앞 = './/' + 태그 + '[normalize-space(text()) = "' + 글 + '"]';
  return 앞 + ' | .//' + 태그 + '[not(' + 앞 + ') and normalize-space() = "' + 글 + '"]';
};
`;

export const { aria식, 태그글식 } = new Function(`${식글}\nreturn { aria식, 태그글식 };`)() as { aria식: (이름: string) => string; 태그글식: (태그: string, 글: string) => string };

const 태그글 = /^([a-z][a-z0-9-]*)=([^"]+)$/;

/**
 * 웹 맥락의 선택자 → W3C 찾기. 받는 꼴은 웹 케이스 순서로 쓰는 것뿐이다 — `[data-testid="…"]` · CSS · `aria/<이름>` · `<태그>=<글>` · XPath(`/` · `./` · `(`).
 * WebdriverIO 의 다른 꼴(`=글` · `*=글` · `~` · `id=` · `android=` · `<태그>` · `>>>`)은 거절한다 — 네이티브 주소를 웹 맥락에 잘못 준 것이다
 */
export function 웹w3c(선택자: string): { using: string; value: string } {
  if (/^(?:\/|\.\/|\.\.\/|\()/.test(선택자)) return { using: 'xpath', value: 선택자 };
  if (선택자.startsWith('aria/')) return { using: 'xpath', value: aria식(선택자.slice(5)) };
  const 꼴 = /^(?:~|id=|android=|ios=|\*?=|<|.*>>>)/.test(선택자) ? null : 태그글.exec(선택자);
  if (꼴) return { using: 'xpath', value: 태그글식(꼴[1]!, 꼴[2]!) };
  if (/^(?:~|id=|android=|ios=|\*?=|<|.*>>>)/.test(선택자) || /^[\w.#-]*\*?=/.test(선택자)) {
    throw new Error(`웹 맥락에서는 ${선택자} 꼴을 안 쓴다 — '[data-testid="…"]' · 'aria/이름' · 'input[placeholder="…"]' · 'button=글' · CSS · XPath 를 쓴다. 네이티브 주소면 context NATIVE_APP 으로 돌아간다`);
  }
  return { using: 'css selector', value: 선택자 };
}

export async function 웹모두찾는다(c: 연결, sid: string, 선택자: string): Promise<string[]> {
  const v = (await 부른다(c, 'POST', `/session/${sid}/elements`, 웹w3c(선택자))) as Record<string, string>[] | null;
  return (v ?? []).map(요소번호);
}

/** 맞은 요소마다 마지막 웹 화면이 단 ref — 화면을 찍은 뒤 새로 생긴 요소는 표가 없다 */
export async function 웹세어본다(c: 연결, sid: string, 선택자: string): Promise<{ 수: number; 줄: string[] }> {
  const ids = await 웹모두찾는다(c, sid, 선택자);
  const 줄 = await Promise.all(
    ids.map(async (id) => {
      const ref = await 부른다(c, 'GET', `/session/${sid}/element/${id}/attribute/${표이름}`).catch(() => null);
      return `- ${typeof ref === 'string' && ref !== '' ? ref : '마지막 화면에 없는 요소'}`;
    }),
  );
  return { 수: ids.length, 줄 };
}

/** ref 로 요소 찾기 — 웹 화면을 찍을 때 단 표로 찾는다. 페이지가 다시 그려지면 표가 없어져 못 찾는다 */
export async function ref로찾는다(c: 연결, sid: string, ref: string): Promise<string> {
  const [id] = await 웹모두찾는다(c, sid, `[${표이름}="${ref}"]`);
  if (id === undefined) throw new Error(`${ref} 가 지금 웹 화면에 없다 — 페이지가 다시 그려졌다. snapshot 을 다시 찍는다`);
  return id;
}

/**
 * 웹뷰 안에서 도는 화면 읽기 — 보이는 요소 가운데 누를 수 있거나 제 글이 있는 것을 줄로 내고, 줄마다 웹 케이스 순서로 하나만 맞는 선택자를 고른다.
 * 순서는 test_platform 웹 케이스와 같다(testid → 이름(role · label) → placeholder → 글 → CSS). XPath 는 짓지 않는다 — 까닭을 남기고 손으로 짓는 자리다.
 * 이름 · 글 꼴은 WebdriverIO 가 바꾸는 XPath 를 그대로 페이지에서 세어 본다. 비밀번호 칸의 값은 싣지 않는다
 */
export const 웹읽기 = `
const 표 = ${JSON.stringify(표이름)};
const 최대 = 300;
for (const e of document.querySelectorAll('[' + 표 + ']')) e.removeAttribute(표);
const 접기 = (s) => (s || '').replace(/\\s+/g, ' ').trim();
const 보임 = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none'; };
const 누름 = 'a[href],button,input,textarea,select,summary,[role],[onclick],[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
const 제글 = (e) => 접기([...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' '));
const 종류 = (e) => {
  const r = e.getAttribute('role'); if (r) return r;
  const t = e.tagName.toLowerCase();
  if (t === 'a') return 'link'; if (t === 'button' || t === 'summary') return 'button'; if (t === 'select') return 'combobox'; if (t === 'textarea') return 'textbox'; if (t === 'img') return 'img';
  if (/^h[1-6]$/.test(t)) return 'heading';
  if (t === 'input') return ({ checkbox: 'checkbox', radio: 'radio', button: 'button', submit: 'button', reset: 'button', image: 'button', range: 'slider' })[e.type] || 'textbox';
  return 'text';
};
const 라벨 = (e) => (e.labels && e.labels.length ? 접기(e.labels[0].innerText) : '');
const 단추값 = (e) => (e.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(e.type) ? 접기(e.value) : '');
const 이름 = (e) => 접기(e.getAttribute('aria-label')) || 라벨(e) || 단추값(e) || (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' ? '' : 접기(e.innerText)) || 접기(e.getAttribute('alt')) || 접기(e.getAttribute('title')) || 접기(e.getAttribute('placeholder'));
const 따 = (v) => '"' + v.replace(/["\\\\]/g, '\\\\$&') + '"';
const 수 = (css) => { try { return document.querySelectorAll(css).length; } catch (_) { return 0; } };
const 찾 = (식) => { try { const r = document.evaluate(식, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null); const 맞 = []; for (let i = 0; i < r.snapshotLength; i++) 맞.push(r.snapshotItem(i)); return 맞; } catch (_) { return []; } };
${식글}
const 하나 = (맞, e) => 맞.length === 1 && (맞[0] === e || e.contains(맞[0]));
const 주소 = (e) => {
  const t = e.tagName.toLowerCase();
  const tid = e.getAttribute('data-testid');
  if (tid) { const s = '[data-testid=' + 따(tid) + ']'; if (수(s) === 1) return s; }
  for (const v of [접기(e.getAttribute('aria-label')), 라벨(e), 제글(e), 접기(e.innerText), 접기(e.getAttribute('title')), 접기(e.getAttribute('alt'))]) {
    if (v !== '' && v.length <= 80 && 하나(찾(aria식(v)), e)) return 'aria/' + v;
  }
  const ph = e.getAttribute('placeholder');
  if (ph) { const s = t + '[placeholder=' + 따(ph) + ']'; if (수(s) === 1) return s; }
  const 글 = 접기(e.textContent);
  if (글 !== '' && 글.length <= 80 && !글.includes('"') && /^[a-z][a-z0-9-]*$/.test(t) && 하나(찾(태그글식(t, 글)), e)) return t + '=' + 글;
  if (e.id && 수('#' + CSS.escape(e.id)) === 1) return '#' + CSS.escape(e.id);
  const nm = e.getAttribute('name');
  if (nm) { const s = t + '[name=' + 따(nm) + ']'; if (수(s) === 1) return s; }
  return null;
};
const 줄 = [];
let 넘침 = 0;
for (const e of document.body ? document.body.querySelectorAll('*') : []) {
  if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(e.tagName)) continue;
  const 누를 = e.matches(누름);
  const 글 = 제글(e);
  if (!누를 && 글 === '' && e.tagName !== 'IMG') continue;
  if (!누를 && e.parentElement && e.parentElement.closest(누름)) continue;
  if (!보임(e)) continue;
  if (줄.length >= 최대) { 넘침++; continue; }
  const ref = 'w' + (줄.length + 1);
  e.setAttribute(표, ref);
  const 칸 = [누를 && 종류(e) === 'text' ? 'generic' : 종류(e)];
  const 이 = 누를 ? 이름(e) : 글 || 접기(e.getAttribute('alt'));
  if (이 !== '') 칸.push(JSON.stringify(이.slice(0, 120)));
  if ((e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') && e.type !== 'password' && e.value) 칸.push('값=' + JSON.stringify(e.value.slice(0, 80)));
  if (e.type === 'password') 칸.push('비밀번호');
  if (e.checked) 칸.push('체크됨');
  if (e.disabled) 칸.push('꺼짐');
  if (document.activeElement === e) 칸.push('포커스');
  칸.push('[ref=' + ref + ']');
  const loc = 주소(e);
  줄.push({ ref, 글: 칸.join(' '), loc });
}
return { title: document.title, url: location.origin + location.pathname, 줄, 넘침 };
`;

export interface 웹화면 {
  글: string;
  refs: Record<string, 웹요소>;
}

const 주소없음 = '주소 없음 — testid · 이름 · placeholder · 글 · id · name 이 없거나 겹친다. XPath 는 까닭을 남기고 손으로 짓는다';

export async function 웹을읽는다(c: 연결, sid: string, 맥락: string): Promise<웹화면> {
  const v = (await 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script: 웹읽기, args: [] })) as {
    title?: string;
    url?: string;
    줄?: { ref: string; 글: string; loc: string | null }[];
    넘침?: number;
  } | null;
  const 줄 = v?.줄 ?? [];
  const refs = Object.fromEntries(줄.map((x) => [x.ref, x.loc === null ? { loc: null, 까닭: 주소없음 } : { loc: x.loc }]));
  const 머리 = `웹 화면 ${맥락} · ${JSON.stringify(v?.title ?? '')} · ${v?.url ?? '?'} · 요소 ${줄.length}개${(v?.넘침 ?? 0) > 0 ? ` (${v?.넘침}개 더 — 줄이 넘쳐 뺐다)` : ''}`;
  return { 글: [머리, ...줄.map((x) => `- ${x.글}`)].join('\n'), refs };
}

/** 웹 맥락에서는 웹 쪽 페이지 바뀜만 본다 — 같은 글을 두 번 읽거나 최대_ms 가 지나면 그 화면을 쓴다 */
export async function 웹이가라앉을때까지(c: 연결, sid: string, 맥락: string, 최대_ms: number, 간격_ms: number): Promise<웹화면> {
  let 화면 = await 웹을읽는다(c, sid, 맥락);
  const 끝 = Date.now() + 최대_ms;
  while (Date.now() < 끝) {
    await new Promise((ok) => setTimeout(ok, 간격_ms));
    const 다음 = await 웹을읽는다(c, sid, 맥락);
    const 같음 = 다음.글 === 화면.글;
    화면 = 다음;
    if (같음) break;
  }
  return 화면;
}

/** 웹 맥락에서 못 쓰는 명령 — 네이티브 화면 글 · UiAutomator2 손짓 · 키보드 · 앱 다시 띄우기를 쓴다 */
export const 네이티브명령 = new Set(['crawl', 'long-press', 'double-tap', 'wait-any', 'scroll-to', 'toast', 'swipe', 'hide-keyboard', 'app', 'attrs', 'screen']);
