/* ==========================================================================
   발레75 — 마이
   계정과 거래에 관한 것들이 모인다.
     · 수강 현황 — 등록한 정규반, 보강, 쿠폰
     · 결제 내역 — 신청·구매 기록
   "언제 어떤 수업을 듣는지"는 내 수업(시간표)의 몫이라 여기서 다루지 않는다.
   ========================================================================== */

import {
  state, isReturningMember, myPerWeek, makeupAvailable, cancelLimit, cancelLeft,
  myCoupons, couponRemaining, fmtMD, fmtYMD, parseYmd,
} from '../state.js';
import { user, NOW, termOf, COUPON_KIND_LABEL, PASS_BADGE_DAYS } from '../data.js';
import { esc, section, icons, empty } from '../ui.js';
import { classCard, classCardList } from '../components.js';

const linkRow = (label, action, note = '') => `
  <button class="linkrow" data-action="${action}">
    <span class="linkrow__label">${esc(label)}</span>
    <span class="linkrow__aside">
      ${note ? `<span class="t-meta">${esc(note)}</span>` : ''}
      ${icons.chevronRight({ size: 17 })}
    </span>
  </button>`;

/** 마감이 가까울 때만 남은 일수를 띄운다 */
const dday = (d) => {
  const left = Math.ceil((d - NOW) / 86400000);
  return left >= 0 && left <= PASS_BADGE_DAYS ? `${left}일 남음` : '';
};

/** 수강권 카드 — 정규반과 쿠폰을 같은 틀로. 눌러서 상세로 간다 */
function passCards() {
  const month = NOW.getMonth();
  const cards = [];

  // 이번 달과 다음 달 — 신청 기간에 담아둔 다음 달 수강권도 여기서 열어야 바꾸거나 무를 수 있다
  for (const m of [month, month + 1]) {
    if (myPerWeek(m) <= 0) continue;
    const term = termOf(m);
    cards.push(classCard({
      type: 'regular',
      kind: `${m + 1}월 정규반`,
      title: `주${myPerWeek(m)}회`,
      term: term ? `${fmtYMD(term.start)} ~ ${fmtYMD(term.end)}` : '',
      badge: term ? dday(term.end) : '',
      rows: [
        ['취소', `${cancelLeft(m)}/${cancelLimit(m)}회 남음`],
        ['보강', `${makeupAvailable(m)}회 가능`],
      ],
      action: 'open-regular',
      id: String(m),
    }));
  }

  // 만료된 쿠폰은 되살릴 수 없어 목록에 남기지 않는다 (myCoupons가 걸러낸다)
  for (const c of myCoupons()) {
    cards.push(classCard({
      type: 'coupon',
      kind: '쿠폰',
      title: COUPON_KIND_LABEL[c.kind] ?? c.name,
      term: `${fmtYMD(parseYmd(c.issuedAt))} ~ ${fmtYMD(parseYmd(c.expiresAt))}`,
      badge: dday(parseYmd(c.expiresAt)),
      rows: [['잔여', `${couponRemaining(c)}/${c.total}회 남음`]],
      action: 'open-coupon',
      id: c.id,
    }));
  }

  if (!cards.length) {
    return empty({
      title: '이용 중인 수강권이 없어요.',
      desc: '정규반을 신청하거나 쿠폰을 구매해 보세요.',
      cta: { label: '수업 찾아보기', action: 'go-enroll' },
    });
  }
  return classCardList(cards);
}

export function accountView() {
  // 섹션 헤더 없이 한 덩어리 — 자주 쓰는 것부터 (Figma 마이 1P/2P)
  const menu = `
    <div class="linklist mt-20">
      ${linkRow('쿠폰 구매', 'coupon-shop')}
      ${linkRow('결제 내역', 'open-payments', `${state.data.payments.length}건`)}
      ${linkRow('비밀번호 변경', 'noop')}
      ${linkRow('로그인 방식 관리', 'noop')}
      ${linkRow('튜토리얼 가이드 다시 보기', 'noop')}
    </div>`;

  const demo = section('프로토타입 상태 보기', `
    <div class="pills" style="flex-wrap:wrap">
      <button class="pill" data-action="demo-reset">상태 초기화</button>
      <button class="pill" data-action="demo-loading">로딩 상태</button>
      <button class="pill" data-action="demo-error">불러오기 실패</button>
      <button class="pill" aria-pressed="${state.demo.failNextSubmit}" data-action="demo-submit-fail">다음 신청 실패</button>
    </div>
    <p class="t-meta mt-16">다음달 신청 오픈 (기존 20일 / 신규 22일)</p>
    <div class="pills mt-8" style="flex-wrap:wrap">
      <button class="pill" aria-pressed="${state.demo.memberType === 'auto'}" data-action="demo-member" data-value="auto">
        자동 판정${isReturningMember() ? ' · 기존' : ' · 신규'}
      </button>
      <button class="pill" aria-pressed="${state.demo.memberType === 'returning'}" data-action="demo-member" data-value="returning">기존 회원</button>
      <button class="pill" aria-pressed="${state.demo.memberType === 'new'}" data-action="demo-member" data-value="new">신규 회원</button>
      <button class="pill" aria-pressed="${state.demo.afterOpen}" data-action="demo-after-open">오픈 이후로 보기</button>
    </div>
    <p class="t-meta mt-16">진행 중인 달 중도 등록 (정책 확정 전)</p>
    <div class="pills mt-8" style="flex-wrap:wrap">
      <button class="pill" aria-pressed="${state.demo.allowMidMonth}" data-action="demo-mid-month">이번 달도 신청 허용</button>
    </div>
    <p class="footnote">화면 상태 확인용 스위치예요. 실제 서비스에는 노출하지 않습니다.</p>`);

  return `
    <header class="hdr">
      <div class="hdr__top"><h1 class="hdr__title">${esc(user.name)} 님</h1></div>
    </header>
    <div class="content">
      <div class="mt-16">${passCards()}</div>
      <div class="band"></div>
      ${menu}
      ${demo}
      <div class="mt-32">
        <button class="btn btn--outline" data-action="noop">로그아웃</button>
      </div>
    </div>`;
}
