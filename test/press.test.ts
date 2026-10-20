// 안 누를 것 · 탈퇴 · 되돌릴 수 없음 · 확인 버튼 · 확인 창 · 로그인 화면 판정 표

import { describe, expect, it } from 'vitest';

import type { 요소 } from '../src/platform/android.js';
import { 되돌릴수없나, 로그인화면인가, 안누를까닭, 탈퇴말인가, 확인버튼고르기, 확인창 } from '../src/press.js';

const 요소 = (x: Partial<요소>): 요소 => ({ cls: 'Button', text: '', desc: '', id: '', bounds: '', 누름: true, 비밀번호: false, 꺼짐: false, 깊이: 0, 속성: {}, ...x });

describe('안누를까닭', () => {
  it.each([
    ['로그아웃', '로그아웃'],
    ['menu item log out', '로그아웃'], // 로그아웃은 길이를 안 본다
    ['Sign out', '로그아웃'],
    ['com.shop:id/btn_log_out', '로그아웃'],
    ['삭제', '위험 글자'],
    ['결제하기', '위험 글자'],
    ['장바구니 담기', '위험 글자'],
    ['Delete', '위험 글자'],
    ['remove item', '위험 글자'],
    ['구독 해지', '위험 글자'],
    ['com.shop:id/delete_all_history_button', '위험 글자'], // id 는 길이를 안 본다
    ['게시글을 삭제하는 방법 안내 보기', null], // 긴 글은 버튼이 아니다
    ['Learn how to remove items from cart', null],
    ['회원 탈퇴', null], // 탈퇴는 누르고 그 뒤 화면에서 멈춘다
    ['Delete my account', null],
    ['상품 보기', null],
    ['com.shop:id/to_cart', null],
  ])('%s → %s', (이름, 까닭) => {
    expect(안누를까닭(이름)).toBe(까닭);
  });

  it('--exclude 식에 맞으면 안 누른다 — /식/i 꼴은 cli 가 RegExp 로 바꿔 준다', () => {
    expect(안누를까닭('Open Settings', [/settings/i])).toBe('--exclude');
    expect(안누를까닭('Open Settings', [/^home$/])).toBeNull();
  });
});

describe('탈퇴말인가 · 되돌릴수없나', () => {
  it.each([
    ['회원 탈퇴', true],
    ['정말 탈퇴하시겠습니까?', true],
    ['Delete my account', true],
    ['close account', true],
    ['Withdraw', true],
    ['회원 해지', true],
    ['계정 삭제', true],
    ['com.shop:id/btn_withdraw', true],
    ['구독 해지', false], // 해지는 계정 · 회원이 붙을 때만
    ['주문 취소', false],
    ['게시글 삭제', false],
  ])('탈퇴 %s → %s', (글, 답) => {
    expect(탈퇴말인가(글)).toBe(답);
  });

  it.each([
    ['삭제하면 복구할 수 없습니다', true],
    ['되돌릴 수 없어요', true],
    ['모든 기록이 삭제됩니다', true],
    ['영구적으로 삭제됩니다', true],
    ['This action cannot be undone.', true],
    ['Your data will be permanently deleted', true],
    ['This is irreversible', true],
    ['저장할까요?', false],
    ['Discard changes?', false],
  ])('경고 %s → %s', (글, 답) => {
    expect(되돌릴수없나(글)).toBe(답);
  });
});

describe('확인버튼고르기', () => {
  it.each<[string[], number | null]>([
    [['취소', '확인'], 1],
    [['확인', '닫기'], 0],
    [['Cancel', 'OK'], 1],
    [['No', 'Yes'], 1],
    [['아니요', '네'], 1],
    [['Dismiss', '×'], null],
    [['', '취소'], null],
  ])('%j → %s', (이름들, 답) => {
    expect(확인버튼고르기(이름들)).toBe(답);
  });
});

describe('확인창', () => {
  const 버튼들 = [요소({ id: 'android:id/button1', text: '확인' }), 요소({ id: 'android:id/button2', text: '취소' })];
  const 글 = (text: string): 요소 => 요소({ cls: 'TextView', id: 'android:id/message', text, 누름: false });

  it('android:id/button 이 없으면 창이 아니다', () => {
    expect(확인창([글('저장할까요?'), 요소({ text: '확인' })])).toBeNull();
  });

  it('그냥 창은 취소가 아닌 마지막 버튼(button1)을 고른다 — 화면 차례와 상관없다', () => {
    expect(확인창([글('저장할까요?'), ...버튼들])).toEqual({ 결과: '누름', 버튼: 버튼들[0] });
  });

  it.each([
    ['탈퇴 글', [글('정말 탈퇴하시겠습니까?'), ...버튼들], false, '탈퇴'],
    ['탈퇴 이름으로 뜬 창', [글('Are you sure?'), ...버튼들], true, '탈퇴'],
    ['되돌릴 수 없음', [글('This action cannot be undone'), ...버튼들], false, '경고'],
    ['입력칸', [요소({ cls: 'EditText', desc: 'name' }), ...버튼들], false, '입력'],
    ['누를 버튼 없음', [글('완료'), 요소({ id: 'android:id/button2', text: 'Cancel' })], false, '남음'],
    ['버튼 칸이 빈 창(제목만)', [요소({ cls: 'TextView', id: 'android:id/alertTitle', text: 'App State has been reset.', 누름: false })], false, '남음'],
  ] as const)('%s → %s', (_, els, 탈퇴로, 결과) => {
    expect(확인창(els, 탈퇴로)).toEqual({ 결과 });
  });
});

describe('로그인화면인가', () => {
  const 아이디 = 요소({ cls: 'EditText', desc: 'Username input field' });
  const 비번 = 요소({ cls: 'EditText', desc: 'Password input field', 비밀번호: true });

  it('아이디 칸과 비밀번호 칸이 같이 있어야 한다', () => {
    expect(로그인화면인가([아이디, 비번])).toBe(true);
    expect(로그인화면인가([요소({ cls: 'AutoCompleteTextView' }), 비번])).toBe(true);
    expect(로그인화면인가([비번])).toBe(false); // 비밀번호 바꾸기 화면
    expect(로그인화면인가([아이디, 요소({ text: 'Login' })])).toBe(false);
  });
});
