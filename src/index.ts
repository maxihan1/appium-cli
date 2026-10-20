// 라이브러리 입구 — test_platform kit · 러너 · 스캐너가 CLI 를 띄우지 않고 화면 키 · 화면 글 · API 줄 규칙을 부른다

import { 화면을가린다, type 화면정보 } from './crawl.js';
import { parseSource } from './platform/android.js';

export { apiLines } from './logcat.js';
export { parseSource };

/**
 * 화면 키 — crawl 이 남기는 `app:<activity>/<화면 이름표>` 와 같은 규칙(`화면을가린다`)이다.
 * xml 은 Appium `GET /session/:id/source`, activity 는 `GET /session/:id/appium/device/current_activity` 값(`.Main` 꼴) 그대로.
 * name 은 화면 머리글 어림(첫 TextView), structFp 는 구조 지문(12자 16진)
 */
export function screenKey(xml: string, activity: string): 화면정보 {
  return 화면을가린다(parseSource(xml), activity);
}
