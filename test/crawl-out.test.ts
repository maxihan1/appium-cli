// 화면 파일 글(입력칸 줄) · 글자지문 · 저장본 모양 · 견주기가 test_platform 규칙과 같은지 본다

import { describe, expect, it } from 'vitest';

import { 견주기, 글자지문, 기록글, 저장본모양 } from '../src/crawl-out.js';
import { parseSource } from '../src/platform/android.js';

const 칸 = (속성: string): string => `<android.widget.EditText text="" content-desc="" resource-id="" clickable="true" enabled="true" bounds="[0,0][10,10]" ${속성} />`;

describe('기록글', () => {
  it('머리 # 화면 키 · 입력칸 줄(password · text · 읽기 전용, 이름은 desc → id) · 화면 글 차례다', () => {
    const h = parseSource(
      `<hierarchy width="1080" height="2400">${칸('content-desc="username input"')}${칸('resource-id="com.shop:id/pw" password="true" text="••••"')}${칸('content-desc="email" enabled="false"')}</hierarchy>`,
    );

    expect(기록글('app:.Main/login screen', h).split('\n').slice(0, 5)).toEqual([
      '# app:.Main/login screen',
      '# 입력칸: text username input',
      '# 입력칸: password com.shop:id/pw',
      '# 입력칸: text email · 읽기 전용',
      '화면 1080x2400 · 요소 3개',
    ]);
  });
});

describe('글자지문', () => {
  it('본문 숫자는 0 으로 보고 # 머리 줄 숫자와 글자는 본다', () => {
    const 처음 = 글자지문('# app:.Main/a\nTextView text="Home" [0,10][20,30] [ref=e1]\n');

    expect(처음).toMatch(/^[0-9a-f]{12}$/);
    expect(글자지문('# app:.Main/a\nTextView text="Home" [5,15][25,35] [ref=e9]\n')).toBe(처음);
    expect(글자지문('# app:.Main/a\nTextView text="Away" [0,10][20,30] [ref=e1]\n')).not.toBe(처음);
    expect(글자지문('# 입력칸: text a · 최대 20자\n')).not.toBe(글자지문('# 입력칸: text a · 최대 30자\n'));
  });
});

const 항목 = (틀: string, 글자: string, 훑은날 = '2026-10-20'): Record<string, unknown> => ({
  키: `로그아웃 ${틀}`, 상태: '로그아웃', 틀, 주소: 틀, 지문: 'aaaaaaaaaaaa', 글자지문: 글자, 기록: 'out-0123456789ab.md', 훑은날,
});

describe('저장본모양', () => {
  it('test_platform 저장본을 받고 틀린 항목은 빼고 판이 다르면 비운다', () => {
    const 좋은 = 항목('app:.Main/a', 'f00');

    expect(저장본모양({ 판: 1, 항목: [좋은, { ...좋은, 상태: '로그인' }, { ...좋은, 기록: 'x.md' }, { ...좋은, 훑은날: '10-20' }, null] })).toEqual({ 판: 1, 항목: [좋은] });
    expect(저장본모양({ 판: 1, 항목: [{ ...좋은, 상태: '로그인:관리자' }] }).항목).toHaveLength(1);
    expect(저장본모양({ 판: 2, 항목: [좋은] })).toEqual({ 판: 1, 항목: [] });
    expect(저장본모양('x')).toEqual({ 판: 1, 항목: [] });
  });
});

describe('견주기', () => {
  it('글자지문이 같고 30일 안이면 같음, 다르거나 30일 넘었으면 바뀜, 없으면 새 화면, 저장본에만 있으면 못 본 화면', () => {
    const 저장 = 저장본모양({
      판: 1,
      항목: [항목('a', 'f00'), 항목('b', 'f00'), 항목('c', 'f00', '2026-09-01'), 항목('gone', 'f00')],
    });
    const 줄 = (틀: string, 글자지문 = 'f00') => ({ 상태: '로그아웃' as const, 틀, 글자지문 });

    const { 표시, 못본 } = 견주기([줄('a'), 줄('b', 'abc'), 줄('c'), 줄('new')], 저장, '2026-10-20');

    expect(Object.fromEntries(표시)).toEqual({
      '로그아웃 a': { 저장본: '같음', 저장기록: 'out-0123456789ab.md' },
      '로그아웃 b': { 저장본: '바뀜' },
      '로그아웃 c': { 저장본: '바뀜' },
      '로그아웃 new': { 저장본: '새 화면' },
    });
    expect(못본.map((x) => x.틀)).toEqual(['gone']);
  });
});
