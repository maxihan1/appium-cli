// 폰 파일 명령의 몸 — 사진 · 영상 · 파일을 넣고, 폴더를 보고, 넣은 파일을 지운다. cli.ts 는 인자를 읽고 여기를 부르기만 한다
// 요청은 test_platform kit `폰에파일넣기` · `폰파일있나` 와 같다 — 탐색에서 고르기 화면에 본 파일이 케이스에서도 같은 자리 · 같은 꼴로 들어가야 한다

import { 부른다, type 연결 } from './appium.js';

const 까닭 = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const 실행 = (c: 연결, sid: string, script: string, arg: Record<string, unknown>): Promise<unknown> => 부른다(c, 'POST', `/session/${sid}/execute/sync`, { script, args: [arg] });
const 셸 = (c: 연결, sid: string, command: string, args: string[]): Promise<unknown> => 실행(c, sid, 'mobile: shell', { command, args });
// 폰 셸은 인자를 이어 붙여 폰의 sh 가 다시 읽는다 — 띄어쓰기 · 한글이 든 폴더도 한 덩어리로 가게 작은따옴표로 싼다
const 싼다 = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;

// kit phoneMedia.ts 와 같은 글 — 64x64 단색 PNG 와 1초 64x64 H.264 MP4(moov 가 앞이라 뒤를 0 으로 늘려도 읽힌다)
const 사진글 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAZElEQVR4nO3PQQ3AIADAQEhQhRkU42kieFyW9BS0c587/mzpgFcNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaB+bdgJkBVFcyAAAAABJRU5ErkJggg==';
const 영상글 = 'AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAN2bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAqB0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAEAAAABAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAQAAABAAAAAAIYbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAKABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABw21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAYNzdGJsAAAAv3N0c2QAAAAAAAAAAQAAAK9hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAEAAQABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANWF2Y0MBZAAK/+EAGGdkAAqs2UQmwEQAAAMABAAAAwAoPEiWWAEABmjr48siwP34+AAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAYcAAAAAAAAAAYc3R0cwAAAAAAAAABAAAABQAACAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAADhjdHRzAAAAAAAAAAUAAAABAAAQAAAAAAEAACgAAAAAAQAAEAAAAAABAAAAAAAAAAEAAAgAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAFAAAAAQAAAChzdHN6AAAAAAAAAAAAAAAFAAAC3AAAAA4AAAAMAAAADAAAAAwAAAAUc3RjbwAAAAAAAAABAAADpgAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjIuMTIuMTAyAAAACGZyZWUAAAMWbWRhdAAAAq0GBf//qdxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjUgcjMyMjIgYjM1NjA1YSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjUgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0xIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0yIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj01IHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAJ2WIhAAS//7oyfzLJ++PUT+DlxVxaccwj0dI/65B2ZLyCHBWQeLicQAAAApBmiRsQ//+qZ00AAAACEGeQniCHwLHAAAACAGeYXRD/wTEAAAACAGeY2pD/wTF';

export type 파일종류 = '사진' | '영상' | '파일';
export const 파일종류인가 = (x: string | undefined): x is 파일종류 => x === '사진' || x === '영상' || x === '파일';

const 자리: Record<파일종류, { 폴더: string; 확장자: string; 글: string }> = {
  사진: { 폴더: '/sdcard/Pictures', 확장자: 'png', 글: 사진글 },
  영상: { 폴더: '/sdcard/Movies', 확장자: 'mp4', 글: 영상글 },
  파일: { 폴더: '/sdcard/Download', 확장자: 'txt', 글: Buffer.from('QA Hub 케이스가 넣은 파일\n').toString('base64') },
};

/** 넣은 파일인가 — rm 은 넣은 파일(세 폴더의 qa- 이름)만 지운다. 폰에 원래 있던 파일은 건드리지 않는다 */
export const 넣은파일인가 = (경로: string): boolean => /^\/sdcard\/(Pictures|Movies|Download)\/qa-[\w.-]+$/.test(경로);

// 사진첩 · 영상 목록에 바로 보이게 — scanMedia 가 없는 Appium 판이면 훑기 방송. 둘 다 안 되면 늦게 보일 뿐이라 던지지 않는다
async function 훑는다(c: 연결, sid: string, 경로: string): Promise<void> {
  try {
    await 실행(c, sid, 'mobile: scanMedia', { remotePath: 경로 });
  } catch {
    await 셸(c, sid, 'am', ['broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE', '-d', `file://${경로}`]).catch(() => undefined);
  }
}

/** 파일 하나를 넣는다 — 크기(바이트)를 주면 작게 보내고 폰 안에서 0 으로 채워 늘린다(팜 요청 본문 상한 64MB) */
export async function 넣는다(c: 연결, sid: string, 종류: 파일종류, 크기?: number): Promise<{ 경로: string; 이름: string }> {
  const 틀 = 자리[종류];
  const 바탕크기 = Buffer.from(틀.글, 'base64').length;
  if (크기 !== undefined && (!Number.isInteger(크기) || 크기 < 바탕크기)) throw new Error(`file push ${종류} 의 --size 는 ${바탕크기}바이트 이상 정수다 — ${크기}`);
  const 이름 = `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.${틀.확장자}`;
  const 경로 = `${틀.폴더}/${이름}`;
  await 부른다(c, 'POST', `/session/${sid}/appium/device/push_file`, { path: 경로, data: 틀.글 }).catch((e: unknown) => {
    throw new Error(`${경로} 를 못 넣었다 — ${까닭(e)}`);
  });
  if (크기 !== undefined && 크기 > 바탕크기) {
    try {
      await 셸(c, sid, 'truncate', ['-s', String(크기), 경로]);
    } catch (e) {
      await 지운다(c, sid, 경로).catch(() => undefined);
      throw new Error(`${경로} 를 ${크기}바이트로 못 늘렸다(폰 셸 — adb_shell 이 닫혔으면 못 쓴다 · 폰 저장 공간) — ${까닭(e)}`);
    }
  }
  await 훑는다(c, sid, 경로);
  return { 경로, 이름 };
}

export async function 지운다(c: 연결, sid: string, 경로: string): Promise<void> {
  await 셸(c, sid, 'rm', ['-f', 경로]).catch((e: unknown) => {
    throw new Error(`${경로} 를 못 지웠다(폰 셸 — adb_shell 이 닫혔으면 못 쓴다) — ${까닭(e)}`);
  });
  await 훑는다(c, sid, 경로);
}

/** 폴더의 파일 이름들 — 폴더가 없으면 빈 목록(앱이 아직 안 만든 다운로드 폴더). 셸이 막혔으면 까닭을 붙여 던진다 */
export async function 본다(c: 연결, sid: string, 폴더: string): Promise<string[]> {
  try {
    return String(await 셸(c, sid, 'ls', ['-1', 싼다(폴더)]))
      .split(/\r?\n/)
      .map((줄) => 줄.trim())
      .filter((줄) => 줄 !== '');
  } catch (e) {
    if (/No such file or directory/.test(까닭(e))) return [];
    throw new Error(`${폴더} 를 못 읽었다(폰 셸 — adb_shell 이 닫혔으면 못 쓴다) — ${까닭(e)}`);
  }
}
