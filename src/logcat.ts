// logcat 줄에서 API 호출(METHOD URL · 시각)을 뽑는다 — 꼴로만 거른다(팜 Appium 에 adb_shell 이 없어 앱 PID 를 못 묻는다)

export interface API {
  method: string;
  url: string;
  at: string;
}

// QA 의 debug 빌드가 남기는 OkHttp 로그 `--> GET https://host/path` (모임 둘: method · url)
export const 기본API꼴 = /--> (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) (https?:\/\/\S+)/;

// 줄 머리의 logcat 시각 `10-20 10:07:55.318` — test_platform 이 이것으로 케이스 단계에 나눈다
const 시각꼴 = /^\d\d-\d\d \d\d:\d\d:\d\d\.\d+/;

export function apiLines(lines: string[], pattern: RegExp = 기본API꼴): API[] {
  return lines.flatMap((l) => {
    const m = pattern.exec(l);
    if (m?.[1] === undefined || m[2] === undefined) return [];
    // 물음표 · # 뒤는 토큰 · 검색어가 실리니 버린다
    return [{ method: m[1], url: m[2].replace(/[?#].*$/, ''), at: 시각꼴.exec(l)?.[0] ?? '' }];
  });
}
