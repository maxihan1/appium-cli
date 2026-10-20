// 라이브러리 입구 — test_platform kit · 러너 · 스캐너가 CLI 를 띄우지 않고 화면 키 · 화면 글 · API 줄 규칙 · 팜 산출물 받기를 부른다

import { 산출물을받는다, 연결주소, type 산출물 } from './appium.js';
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

/**
 * 팜 session 산출물(logcat.txt · video-N.mp4 …)을 outDir 에 받는다 — CLI `artifacts` 와 같다.
 * appiumUrl 은 Appium 주소(`http://farm:4723/wd/hub`), token 은 팜 개인 토큰(Bearer).
 * 팜이 아직 만드는 중이면 15초까지 기다린다. errors 는 팜이 못 만든 산출물의 까닭
 */
export function farmArtifacts(appiumUrl: string, sessionId: string, outDir: string, opts: { token?: string } = {}): Promise<{ files: 산출물[]; errors: string[] }> {
  return 산출물을받는다(연결주소(appiumUrl, opts.token), sessionId, outDir);
}
