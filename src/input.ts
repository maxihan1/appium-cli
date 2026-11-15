// 입력 — press 가 받는 폰 키 이름과 Android keycode (test_platform kit 키누르기 와 같은 표)

/** CLI 키 이름 → kit `키누르기` 의 키 이름 · keycode. 키보드 완료 · 검색은 fill --submit, 뒤로는 back 이라 여기 없다 */
export const 폰키 = {
  home: { 이름: '홈', keycode: 3 },
  recent: { 이름: '최근 앱', keycode: 187 },
  delete: { 이름: '지우기', keycode: 67 },
  tab: { 이름: '탭', keycode: 61 },
  paste: { 이름: '붙여 넣기', keycode: 279 },
} as const;

export type 키 = keyof typeof 폰키;
export const 키인가 = (x: string | undefined): x is 키 => x !== undefined && Object.hasOwn(폰키, x);
