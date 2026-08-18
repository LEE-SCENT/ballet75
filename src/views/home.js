/* ==========================================================================
   발레75 — 홈 (Figma 60:13971 · 60:14003 · 60:14019)
   위에서부터 "지금 눈에 걸려야 하는 것 → 오늘/다음 수업 → 부가 진입"
   통계 대시보드가 아니라 오늘 일정과 Action Required를 우선한다. (PRD §7)
   ========================================================================== */

import {
  state, todayClasses, nextClass, upcomingClasses,
  enrollmentWindow, makeupAvailable, makeupDeadline, activeCoupons, couponRemaining,
  hhmm, parseYmd, fmtMD, fmtMDDow, isSameDay, dayStart,
} from '../state.js';
import { NOW, user, PASS_BADGE_DAYS, ENROLLMENT_NOTICE_DAY } from '../data.js';
import {
  esc, icons, errorState, skeletonList, skeletonBlock, placeLine,
} from '../ui.js';
import { classListCard, classListRow, alertCard, emptyBox } from '../components.js';

/** 로고 + 인사 한 줄 */
const header = () => `
  <header class="hdr hdr--home">
    <span class="hdr__mark" aria-hidden="true">
      <span class="hdr__mark-img"><img src="assets/logo-ballet75.png" alt=""></span>
    </span>
    <h1 class="hdr__title">안녕하세요, ${esc(user.name)} 님</h1>
  </header>`;

/**
 * 남은 일수 — 날짜끼리 센다.
 * 시각으로 빼면 마감이 23:59인 값이 하루 더 남은 것처럼 올림된다.
 */
const dday = (d) => {
  const left = Math.round((dayStart(d) - dayStart(NOW)) / 86400000);
  return left <= 0 ? '오늘' : `${left}일 남음`;
};

/**
 * 마감이 코앞인가 — 수강권 카드의 남은 일수 배지와 같은 기준(7일).
 * 아직 여유가 있는 보강·쿠폰까지 홈 맨 위에 세우면 급한 것과 구분이 안 된다.
 */
const urgent = (d) => Math.round((dayStart(d) - dayStart(NOW)) / 86400000) <= PASS_BADGE_DAYS;

/* --- 알림 (60:13977 classCard) --------------------------------------------
   순서는 급한 것부터 — 신규 안내 → 신청 오픈 → 보강 → 쿠폰. */
function alerts() {
  const out = [];
  const w = enrollmentWindow(NOW.getMonth() + 1);
  const isNew = !w.returning;

  // 처음 온 회원에게는 신청 전에 읽을 것이 먼저다
  if (isNew) {
    out.push(alertCard({
      tone: 'guide',
      icon: icons.infoFilled({ size: 20 }),
      text: '발레를 처음 시작하는 분들을 위한 Q&A',
      arrow: true,
      action: 'noop',
    }));
  }

  if (w.kind === 'upcoming' && w.open) {
    out.push(alertCard({
      tone: 'notice',
      icon: icons.infoFilled({ size: 20 }),
      text: `<b>${NOW.getMonth() + 2}월 수강신청</b>이 열렸어요`,
      arrow: true,
      action: 'go-next-month',
    }));
  } else if (w.kind === 'upcoming' && NOW.getDate() >= ENROLLMENT_NOTICE_DAY) {
    out.push(alertCard({
      tone: 'notice',
      icon: icons.infoFilled({ size: 20 }),
      // 배지 없음 — 문장에 날짜가 이미 있고, 오픈 전에는 재촉해도 할 수 있는 게 없다.
      // 카운트다운은 '놓치면 잃는' 보강·쿠폰에만 둔다.
      text: `${isNew ? '신규' : '기존'} 회원 수강신청은 <b>${fmtMD(w.openAt)}</b>부터 가능해요`,
    }));
  }

  const makeup = makeupAvailable();
  if (makeup && urgent(makeupDeadline())) {
    out.push(alertCard({
      tone: 'makeup',
      icon: icons.flower({ size: 20 }),
      text: `이번 달 보강 가능한 수업이 <b>${makeup}회</b> 있어요`,
      badge: dday(makeupDeadline()),
      action: 'find-makeup',
    }));
  }

  // 만료가 가장 가까운 쿠폰 한 장만 — 여러 장을 다 세우면 신호가 죽는다
  const coupon = activeCoupons()
    .slice()
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0];
  if (coupon && urgent(parseYmd(coupon.expiresAt))) {
    const at = parseYmd(coupon.expiresAt);
    out.push(alertCard({
      tone: 'coupon',
      icon: icons.ticket(true),
      text: `${at.getMonth() + 1}/${at.getDate()}까지 사용 가능한 쿠폰이 <b>${couponRemaining(coupon)}회</b> 남았어요`,
      badge: dday(at),
      action: 'use-coupon',
      id: coupon.id,
    }));
  }

  return out.length ? `<div class="alerts">${out.join('')}</div>` : '';
}

/* --- 오늘 / 다음 수업 ----------------------------------------------------- */
const labeled = (label, body) => `
  <div class="daysec"><p class="daysec__label">${esc(label)}</p>${body}</div>`;

function todaySection() {
  const today = todayClasses();
  if (!today.length) return '';
  // 내 수업의 '오늘' 묶음과 같은 accent 카드 — 두 화면에서 같은 것이 같아 보여야 한다
  return labeled('오늘 수업', classListCard({
    tone: 'accent',
    rows: today.map((c) => classListRow({
      id: c.id,
      start: hhmm(c.startAt),
      end: hhmm(c.endAt),
      title: c.name,
      meta: placeLine(c),
      past: c.startAt < NOW,
    })),
  }));
}

function nextSection() {
  const upcoming = upcomingClasses().filter((c) => !isSameDay(c.startAt, NOW)).slice(0, 3);
  if (!upcoming.length) return '';
  return labeled('다음 수업', classListCard({
    rows: upcoming.map((c) => classListRow({
      id: c.id,
      start: hhmm(c.startAt),
      end: hhmm(c.endAt),
      title: c.name,
      meta: `${fmtMDDow(c.startAt)} · ${placeLine(c)}`,
    })),
  }));
}

/**
 * 전체 수업 보기 — 홈은 오늘과 다음 3회까지만 세운다.
 * 그 뒤가 궁금한 사람에게 '내 수업'으로 가는 길을 한 줄로 준다.
 * 진입일 뿐 결정이 아니라서, 이 앱에서 가벼운 보조 버튼을 맡는 ghost를 쓴다.
 */
const moreClasses = () => `
  <button class="btn btn--ghost mt-8" data-action="go-my">전체 수업 보기</button>`;

/* --- 부가 진입 (60:14001 buttonGroup) -------------------------------------- */
const shortcuts = () => `
  <div class="band"></div>
  <div class="btn-stack mt-20">
    <button class="btn btn--primary btn--sm" data-action="coupon-shop">쿠폰 구매</button>
    <button class="btn btn--outline btn--sm" data-action="go-private">개인레슨 예약</button>
    <button class="btn btn--outline btn--sm" data-action="level-guide">레벨 안내</button>
  </div>`;

/* --- view ----------------------------------------------------------------- */
export function homeView() {
  if (state.loadError) {
    return `${header()}<div class="content">${errorState({
      title: '수업 정보를 불러오지 못했어요.',
      desc: '잠시 후 다시 시도해 주세요.',
    })}</div>`;
  }

  if (state.booting) {
    return `${header()}<div class="content">
      <div class="section">${skeletonBlock(140)}</div>
      <div class="section">${skeletonList(2)}</div>
    </div>`;
  }

  // 수업이 하나도 없어도 "언제 신청할 수 있는지"는 반드시 보여야 한다.
  // 신규 회원에게는 그게 홈에 온 유일한 이유다.
  const schedule = todaySection() + nextSection();

  return `${header()}
    <div class="content">
      ${alerts()}
      ${schedule
    ? schedule + moreClasses()
    : `<div class="mt-16">${emptyBox('신청한 수업이 없어요')}</div>`}
      ${shortcuts()}
    </div>`;
}
