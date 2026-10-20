// crawl 이 무엇을 안 누를지 — 위험 글자 · 로그아웃 · 탈퇴 · 확인 창 · 로그인 풀림 판정 (test_platform scripts/authoring-crawl-press.ts · -rules.ts 의 글자 판정만 옮겼다)

import type { 요소 } from './platform/android.js';

// 누르면 무엇을 바꾸는 이름 — test_platform `위험글자`(authoring-crawl-rules.ts)와 같다
const 위험글자 = /로그아웃|로그오프|탈퇴|삭제|담기|결제|구매하기|주문하기|신청하기|추천|좋아요|해지|스크랩|logout|log\s?out|log\s?off|sign\s?out|delete|remove|unsubscribe|withdraw/i;
// 탈퇴 흐름 — 「해지」만은 구독 해지일 수 있어 계정 · 회원이 붙을 때만 본다
const 탈퇴말 = /탈퇴|withdraw|unregister|deactivate|(?:계정|회원)\s*(?:삭제|해지|닫기)|(?:delete|close)\s*(?:my\s*)?account/i;
const 로그아웃말 = /로그아웃|로그오프|log\s?-?out|log\s?-?off|sign\s?-?out/i;
const 그만말 = /취소|닫기|아니[오요]|cancel|close|dismiss|^no$|^[×x✕]$/i;
// 낯선 이름의 탈퇴도 확인 창은 대개 이렇게 경고한다
const 되돌릴수없음 =
  /복구(?:할|가)?\s*수\s*없|복구되지\s*않|되돌릴\s*수\s*없|영구(?:적으로|히)?\s*(?:삭제|사라|지워)|(?:모든|모두)\s*\S*\s*(?:삭제|사라)|cannot\s+be\s+(?:undone|recovered|restored)|permanently\s+(?:delet|remov|eras)|irreversibl/i;

const id꼴 = /^[\w.]+:id\//;
// resource-id(`com.shop:id/btn_log_out`)는 꾸러미를 떼고 _ · - 를 띄어 글자처럼 본다
const 낱말 = (이름: string): string => 이름.replace(id꼴, '').replace(/[_-]+/g, ' ');

export const 탈퇴말인가 = (글: string): boolean => 탈퇴말.test(낱말(글));
export const 되돌릴수없나 = (글: string): boolean => 되돌릴수없음.test(글);

/**
 * 후보를 안 누르는 까닭, 누르면 null. 이름은 desc → id → 글자.
 * 로그아웃은 늘 안 누른다(다시 로그인은 F5-05). 위험 글자는 12자 이하 이름만 — 긴 글은 버튼이 아니라 본문이다. id 는 글이 아니라 길이를 안 본다.
 * 탈퇴 이름은 누른다 — 그 뒤 화면은 탈퇴 흐름이라 아무것도 안 누르고 뜬 확인 창도 안 누른다(test_platform 과 같다)
 */
export function 안누를까닭(이름: string, 뺄: readonly RegExp[] = []): string | null {
  if (뺄.some((r) => r.test(이름))) return '--exclude';
  const 글 = 낱말(이름);
  if (로그아웃말.test(글)) return '로그아웃';
  if (탈퇴말.test(글)) return null;
  if ((id꼴.test(이름) || 글.trim().length <= 12) && 위험글자.test(글)) return '위험 글자';
  return null;
}

/** 확인 창에서 누를 버튼 — 취소 · 닫기가 아닌 것 가운데 마지막(확인 버튼이 오른쪽 끝에 오는 관례). 없으면 null */
export function 확인버튼고르기(이름들: readonly string[]): number | null {
  for (let i = 이름들.length - 1; i >= 0; i--) {
    const 이름 = 이름들[i]!.trim();
    if (이름 !== '' && !그만말.test(이름)) return i;
  }
  return null;
}

export type 창결과 = '탈퇴' | '경고' | '입력' | '누름' | '남음';

export const 입력칸인가 = (e: 요소): boolean => /EditText|AutoCompleteTextView/.test(e.cls);

/**
 * Android 확인 창(AlertDialog — 버튼 `android:id/button1` 확인 · `button2` 취소 · `button3` 가운데, 버튼이 비면 `android:id/alertTitle` · `parentPanel`)이면 무엇을 할지, 창이 아니면 null.
 * 탈퇴 글 · 되돌릴 수 없다는 경고 · 입력칸이 있으면 안 누르고, 아니면 확인 버튼 하나. 누를 버튼이 없으면 '남음'.
 * 탈퇴로 = 탈퇴 이름을 눌러 뜬 창 — 글이 무엇이든 안 누른다
 */
export function 확인창(els: readonly 요소[], 탈퇴로 = false): { 결과: 창결과; 버튼?: 요소 } | null {
  // 화면 차례가 button3 · button2 · button1 이 아닐 수 있어 id 로 줄 세운다 — 확인(button1)이 마지막
  const 버튼들 = els.filter((e) => /^android:id\/button[123]$/.test(e.id)).sort((a, b) => b.id.localeCompare(a.id));
  // 버튼 없이 제목 · 틀만 온 창도 창이다 — UiAutomator2 가 버튼 칸을 비워 줄 때가 있다(MDA 「App State has been reset.」 실측)
  if (버튼들.length === 0 && !els.some((e) => /^android:id\/(?:alertTitle|parentPanel)$/.test(e.id))) return null;
  const 글 = els.map((e) => `${e.text} ${e.desc}`).join(' ');
  if (탈퇴로 || 탈퇴말.test(글)) return { 결과: '탈퇴' };
  if (되돌릴수없나(글)) return { 결과: '경고' };
  if (els.some(입력칸인가)) return { 결과: '입력' };
  const i = 확인버튼고르기(버튼들.map((e) => e.text || e.desc));
  return i === null ? { 결과: '남음' } : { 결과: '누름', 버튼: 버튼들[i]! };
}

/** 로그인 풀림 — 아이디 칸(비밀번호가 아닌 입력칸)과 비밀번호 칸이 같이 뜬 화면 (test_platform `로그인풀렸나` 의 칸 판정) */
export const 로그인화면인가 = (els: readonly 요소[]): boolean => els.some((e) => e.비밀번호) && els.some((e) => 입력칸인가(e) && !e.비밀번호);
