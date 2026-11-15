// 화면 머리 줄 판정(같은 id 세기 · 잠깐 뜬 글 고르기 · 줄 상한 · 굴림 표시 · 머리 끼우기)을 본다

import { describe, expect, it } from 'vitest';

import { 같은id줄, 머리줄끼우기, 밀림표시, 잠깐뜬글, 줄더하기, 창글, 처음줄들 } from '../src/crawl-motion.js';
import { parseSource } from '../src/platform/android.js';

const 칸 = (cls: string, 속성: string): string => `<android.widget.${cls} ${속성} clickable="false" bounds="[0,0][9,9]" />`;
const 화면 = (...칸들: string[]) => parseSource(`<hierarchy width="1080" height="2400">${칸들.join('')}</hierarchy>`);
const 글 = (t: string, cls = 'TextView'): string => 칸(cls, `text="${t}" content-desc="" resource-id=""`);
const 같은것 = (id: string, n: number): string[] => Array.from({ length: n }, () => 칸('TextView', `text="" content-desc="" resource-id="${id}"`));

describe('같은id줄', () => {
  it('두 번 넘게 나온 id 만 많은 차례로 5개까지, android: id 는 뺀다', () => {
    const h = 화면(...같은것('a', 3), ...같은것('b', 5), ...같은것('c', 2), ...같은것('android:id/x', 9), ...['d', 'e', 'f', 'g'].flatMap((id) => 같은것(id, 3)));

    expect(같은id줄(Object.values(h.refs))).toBe('# 같은 id: id=b 5개 · id=a 3개 · id=d 3개 · id=e 3개 · id=f 3개');
    expect(같은id줄(Object.values(화면(...같은것('a', 2)).refs))).toBeNull();
  });
});

describe('잠깐뜬글', () => {
  it('Toast · 스낵바 글을 고르고, 중간 읽기에만 있던 보통 글 · 앞 화면에 있던 Toast 는 뺀다', () => {
    const 앞 = 화면(글('이전 화면'), 글('지난 토스트', 'Toast'));
    const 스낵바 = 칸('TextView', 'text="담았습니다" content-desc="" resource-id="com.shop:id/snackbar_text"');
    const 읽음 = [화면(글('이전 화면'), 글('불러오는 중')), 화면(글('저장했습니다', 'Toast'), 글('지난 토스트', 'Toast')), 화면(글('새 화면'), 스낵바)];

    expect(잠깐뜬글(읽음, 앞.글)).toEqual(['저장했습니다', '담았습니다']);
    expect(잠깐뜬글([화면(글('새 화면'))], 앞.글)).toEqual([]);
  });

  it('3개까지 · 40자까지', () => {
    const 긴글 = '가'.repeat(60);

    expect(잠깐뜬글([화면(...['하나', '둘', '셋', '넷'].map((t) => 글(t, 'Toast')))], '')).toEqual(['하나', '둘', '셋']);
    expect(잠깐뜬글([화면(글(긴글, 'Toast')), 화면(글('끝'))], '')).toEqual(['가'.repeat(40)]);
  });
});

describe('창글', () => {
  it('제목 · 본문을 슬래시로 잇고 둘 다 없으면 null', () => {
    const 제목 = 칸('TextView', 'text="저장할까요?" content-desc="" resource-id="android:id/alertTitle"');
    const 본문 = 칸('TextView', 'text="변경 내용을 저장합니다" content-desc="" resource-id="android:id/message"');

    expect(창글(Object.values(화면(제목, 본문).refs))).toBe('저장할까요? / 변경 내용을 저장합니다');
    expect(창글(Object.values(화면(제목).refs))).toBe('저장할까요?');
    expect(창글(Object.values(화면(글('x')).refs))).toBeNull();
  });
});

describe('줄더하기 · 밀림표시 · 처음줄들', () => {
  it('같은 줄은 한 번, 20줄까지', () => {
    const 줄들: string[] = [];
    for (let i = 0; i < 30; i++) 줄더하기(줄들, `# 앱 밖: ${i % 25}`);

    expect(줄들).toHaveLength(20);
    expect(new Set(줄들).size).toBe(20);
  });

  it('굴림 줄에 밀면 새 줄이 보인다를 한 번만 붙이고, 줄이 없으면 그 줄째 더한다', () => {
    const 목록 = Object.values(화면(칸('RecyclerView', 'text="" content-desc="상품 목록" resource-id="" scrollable="true"')).refs)[0]!;
    const 줄들 = 처음줄들(화면(), 목록, 3);

    expect(줄들).toEqual(['# 굴림: 목록 「상품 목록」']);
    밀림표시(줄들, 목록);
    밀림표시(줄들, 목록);
    expect(줄들).toEqual(['# 굴림: 목록 「상품 목록」 — 밀면 새 줄이 보인다']);
    const 없던 = ['# 앱 밖: x'];
    밀림표시(없던, 목록);
    expect(없던).toEqual(['# 앱 밖: x', '# 굴림: 목록 「상품 목록」 — 밀면 새 줄이 보인다']);
  });

  it('계속 움직임 줄에는 기다린 초를 쓴다', () => {
    const h = 화면(글('x'));
    h.기다림 = { 계속: true, 잠깐: [] };

    expect(처음줄들(h, undefined, 3)).toEqual(['# 계속 움직임: 누른 뒤 기다리는 동안(최대 3초) 화면 글이 멈추지 않았다 — 기다릴 때 움직이는화면에서 를 쓴다']);
  });
});

describe('머리줄끼우기', () => {
  it('첫 줄 바로 뒤에 끼우고 줄이 없으면 그대로 둔다', () => {
    expect(머리줄끼우기('# k\n본문\n', ['# a', '# b'])).toBe('# k\n# a\n# b\n본문\n');
    expect(머리줄끼우기('# k\n본문\n', [])).toBe('# k\n본문\n');
  });
});
