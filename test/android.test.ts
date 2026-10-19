// Android 화면 XML 을 ref 붙은 글로 줄이는 규칙과 locator 고르기를 본다

import { describe, expect, it } from 'vitest';

import { capabilities, center, locatorFor, parseSource, w3c } from '../src/platform/android.js';

import { 화면XML } from './fixture.js';

describe('parseSource', () => {
  const 화면 = parseSource(화면XML);
  const 줄 = 화면.글.split('\n');

  it('test_platform 화면을줄인다 와 같은 줄에 ref 만 붙인다', () => {
    expect(줄).toEqual([
      '화면 1080x2400 · 요소 4개',
      'ViewGroup id=com.shop:id/root [0,0][1080,2400] [ref=e1]',
      '  TextView text="Tom & Jerry > 1" [10,20][30,40] [ref=e2]',
      '  Button desc="로그인 > 시작" 클릭 꺼짐 [10,50][30,70] [ref=e3]',
      '  EditText id=com.shop:id/pw 클릭 [10,80][30,90] [ref=e4]',
    ]);
  });

  it('비밀번호 칸 글자는 화면 글에도 ref 표에도 싣지 않는다', () => {
    expect(화면.글).not.toContain('••••');
    expect(화면.refs.e4!.text).toBe('');
  });

  it('화면 크기를 돌려준다', () => {
    expect([화면.width, 화면.height]).toEqual([1080, 2400]);
  });

  it('desc → id 순으로 고르고, 글자만 있으면 고르지 않는다', () => {
    expect(locatorFor(화면.refs.e3!)).toBe('~로그인 > 시작');
    expect(locatorFor(화면.refs.e4!)).toBe('id=com.shop:id/pw');
    expect(locatorFor(화면.refs.e2!)).toBeNull();
  });
});

describe('도우미', () => {
  it('선택자를 W3C using · value 로 바꾼다', () => {
    expect(w3c('~로그인')).toEqual({ using: 'accessibility id', value: '로그인' });
    expect(w3c('id=com.shop:id/pw')).toEqual({ using: 'id', value: 'com.shop:id/pw' });
  });

  it('bounds 의 가운데를 구한다', () => {
    expect(center('[10,50][30,70]')).toEqual({ x: 20, y: 60 });
    expect(center('')).toBeNull();
  });

  it('capabilities 는 test_platform kit 과 같고 newCommandTimeout 만 늘린다', () => {
    expect(capabilities('/a.apk', 'R5CT')).toEqual({
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:app': '/a.apk',
      'appium:newCommandTimeout': 300,
      'appium:udid': 'R5CT',
    });
  });
});
