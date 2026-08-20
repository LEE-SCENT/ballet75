/* ==========================================================================
   발레75 — 수강신청
   "어떤 수업을 신청할 수 있지?"

   정규: 선택 단위가 날짜가 아니라 **요일 + 시간의 반**이다.
         주 몇 회를 정하고 → 반을 담으면 그 달의 남은 회차가 함께 따라온다.
   보강·쿠폰: 날짜를 골라 그 날 수업 하나를 신청한다. 수단은 신청할 때 정한다.

   수업을 담기 전에는 신청/선택 관련 컨트롤을 노출하지 않는다. (PRD §11–14)
   ========================================================================== */

import {
  state, regularSlots, slotStatus, SLOT_STATUS_LABEL, selection, enrollmentWindow,
  singleBookingList, singleSelectedDay, couponRemaining, bookingMethodNames,
  startOfWeek, addDays, makeupAvailable, makeupDeadline, regularPrice, activeCoupons,
  timeRange, hhmm, fmtFullDate, fmtMD, parseYmd, isSameDay, won, filterChipCount,
} from '../state.js';
import { NOW, ymd, cancelLimitFor, QUOTA_UNCONFIRMED, ENROLL_READY } from '../data.js';
import { esc, icons, statusChip, section, empty, errorState, skeletonList, placeLine } from '../ui.js';
import { classListCard, classListRow, segmentedControl, infoNotice, emptyBox } from '../components.js';

// 지난달은 신청·보강 모두 불가라 노출하지 않는다 — 이번 달 + 다음 달만
const MONTHS = [NOW.getMonth(), NOW.getMonth() + 1];
const PER_WEEK = [1, 2, 3, 4];
const WD_LABEL = ['일', '월', '화', '수', '목', '금', '토'];
const CAL_ORDER = [0, 1, 2, 3, 4, 5, 6];        // 일요일 시작

/* --- Header --------------------------------------------------------------- */
function header() {
  if (state.enroll.mode === 'single') {
    // 보강·쿠폰을 한 화면에서 고른다. 어떤 수단으로 쓸지는 신청할 때 정한다.
    const makeup = makeupAvailable();
    const parts = [
      makeup ? `보강 ${makeup}회` : '',
      ...activeCoupons().map((c) => `${c.name.replace(/\s*\d+회권$/, '')} ${couponRemaining(c)}회`),
    ].filter(Boolean);
    return `
      <header class="hdr">
        <div class="hdr__top">
          <h1 class="hdr__title">수업 신청</h1>
          <button class="icon-btn" data-action="exit-makeup" aria-label="신청 종료">${icons.close()}</button>
        </div>
        <p class="t-support mt-8">
          ${parts.length ? `쓸 수 있는 ${parts.join(' · ')}` : '쓸 수 있는 보강이나 쿠폰이 없어요'}
        </p>
      </header>`;
  }

  return `
    <header class="hdr">
      <div class="hdr__top"><h1 class="hdr__title">수강신청</h1></div>
    </header>`;
}

/**
 * 월 pill의 라벨 — 붙는 상태는 그 달의 "수강신청 상태"다.
 * 이번 달은 신청 대상이 아니므로 상태를 붙이지 않는다.
 */
function monthLabel(m) {
  const w = enrollmentWindow(m);
  if (w.kind === 'upcoming') return w.open ? `${m + 1}월 · 진행 중` : `${m + 1}월 · 오픈예정`;
  return `${m + 1}월`;
}

function monthPills() {
  return `
    <div class="mt-16">
      <div class="pills">
        ${MONTHS.map((m) => `
          <button class="pill" aria-pressed="${state.enroll.month === m}" data-action="enroll-month" data-value="${m}">${monthLabel(m)}</button>
        `).join('')}
      </div>
    </div>`;
}

/**
 * 캘린더는 요일을 골라 담는 선택 도구다.
 * 신청이 열리지 않은 달에는 담을 수 없으므로 시간표만 보여준다.
 */
function viewSwitch(canPick) {
  const activeCount = filterChipCount();
  return `
    <div class="row-between mt-16">
      ${canPick ? `
        <div style="width:216px">${segmentedControl({
    id: 'enroll',
    options: [
      { value: 'grid', label: '시간표' },
      { value: 'timetable', label: '목록' },
      { value: 'calendar', label: '캘린더' },
    ],
    value: state.enroll.view,
    action: 'enroll-view',
    from: state.ui.segFrom?.enroll,
  })}</div>` : `<span class="t-meta">${state.enroll.month + 1}월에 열리는 반이에요</span>`}
      <div style="display:flex;gap:7px">
        <button class="pill" data-action="level-guide">레벨 안내</button>
        <button class="pill ${activeCount ? 'pill--count' : ''}" data-action="open-filter" aria-pressed="false">
          ${icons.filter()} 필터${activeCount ? ` ${activeCount}` : ''}
        </button>
      </div>
    </div>`;
}

/* ==========================================================================
   정규 — 주 N회 + 반(요일) 선택
   ========================================================================== */

/* --- 신청 기간 안내 (현재달 20일 기존 / 22일 신규 ~ 말일) ------------------ */
function windowNotice(w) {
  if (w.kind === 'current') {
    if (w.open) return '<p class="t-meta mt-16">이번 달은 남은 회차만 신청할 수 있어요.</p>';

    const nextMonth = NOW.getMonth() + 1;
    const next = enrollmentWindow(nextMonth);
    const makeup = makeupAvailable();
    const coupons = activeCoupons().length;
    // 정규 신청만 끝났을 뿐, 보강·쿠폰으로는 이번 달 수업을 신청할 수 있다
    const ways = [makeup ? '보강' : '', coupons ? '쿠폰' : ''].filter(Boolean);
    const ctas = [
      next.open ? `<button class="btn btn--primary btn--sm" data-action="go-next-month">${nextMonth + 1}월 신청하기</button>` : '',
      makeup ? '<button class="btn btn--outline btn--sm" data-action="find-makeup">보강 수업 찾기</button>' : '',
      coupons ? '<button class="btn btn--outline btn--sm" data-action="use-coupon">쿠폰으로 신청</button>' : '',
    ].filter(Boolean).join('');

    return `
      <div class="window-notice mt-16">
        <p class="window-notice__title">이번 달 정규 신청은 마감됐어요</p>
        <p class="window-notice__desc">
          ${ways.length
            ? `${ways.join('과 ')}으로는 이번 달 수업을 신청할 수 있어요.`
            : '지금은 이번 달 시간표를 보는 화면이에요.'}
        </p>
        <p class="window-notice__desc">
          ${next.open
            ? `${nextMonth + 1}월 수강신청은 ${fmtMD(next.closeAt)}까지 열려 있어요.`
            : `${nextMonth + 1}월 수강신청은 ${fmtMD(next.openAt)}에 열려요.`}
        </p>
        ${ctas ? `<div class="card__cta" style="display:flex;gap:8px">${ctas}</div>` : ''}
      </div>`;
  }

  if (w.kind !== 'upcoming') return '';

  if (w.open) {
    return `
      <div class="window-notice is-open mt-16">
        <p class="window-notice__title">${state.enroll.month + 1}월 수강신청이 열렸어요</p>
        <p class="window-notice__desc">${fmtMD(w.closeAt)}까지 자리가 남은 반을 신청할 수 있어요.</p>
      </div>`;
  }

  // 아직 열리지 않은 상태 — "열려 있어요" 같은 현재형을 쓰지 않는다.
  // 본인 오픈일을 제목으로 두고, 다른 회원 유형의 날짜는 아래 한 줄로 붙인다.
  // 회원 유형 판정(isReturningMember)은 아직 확정 정책이 아니라서,
  // 한 날짜만 단정해 보여주면 틀렸을 때 회원이 알아챌 방법이 없다.
  // 남은 일수는 본인 줄에만 붙는다 — 실제 잠금도 본인 오픈일로 결정되기 때문이다.
  return `
    <div class="window-notice window-notice--soon mt-16">
      <span class="window-notice__mark">${icons.flower()}</span>
      <div class="window-notice__body">
        <p class="window-notice__title">${fmtMD(w.openAt)} 오전 ${w.openAt.getHours()}시에 열려요</p>
        <p class="window-notice__sub">
          ${w.returning ? '처음 신청하는 회원은' : '기존 회원은'}
          ${w.openAt.getMonth() + 1}월 ${w.otherDay}일에 열려요
        </p>
      </div>
      <span class="window-notice__dday">${w.daysLeft ? `${w.daysLeft}일 남음` : '오늘'}</span>
    </div>`;
}

function perWeekPicker() {
  const { perWeek, selectedSlots } = state.enroll;
  const plan = regularPrice(perWeek);
  return `
    <section class="section" style="margin-top:22px">
      <div class="section__head">
        <h2 class="t-section">주 몇 회 들으시나요?</h2>
        <span class="t-meta">${selectedSlots.length}/${perWeek} 선택</span>
      </div>
      <div class="pills">
        ${PER_WEEK.map((n) => `
          <button class="pill" aria-pressed="${perWeek === n}" data-action="per-week" data-value="${n}">주 ${n}회</button>
        `).join('')}
      </div>
      ${plan ? `
        <div class="planline mt-12">
          <span class="planline__price">${won(plan.month)}</span>
          <span class="planline__meta">
            회당 ${won(plan.perSession)}${plan.discount ? ` · ${plan.discount}% 할인` : ''}
            · 취소·보강 월 ${cancelLimitFor(perWeek)}회${QUOTA_UNCONFIRMED.includes(perWeek) ? '*' : ''}
          </span>
        </div>` : ''}
      ${QUOTA_UNCONFIRMED.includes(perWeek)
        ? '<p class="footnote">* 취소·보강 횟수는 운영 정책 확정 전이에요.</p>' : ''}
    </section>`;
}

/** 회차 요약 — "9월 4회 · 7·14·21·28일" */
function sessionSummary(slot) {
  if (!slot.remaining.length) return '남은 회차가 없어요';
  return `${state.enroll.month + 1}월 ${slot.remaining.length}회 · ${slot.remaining.map((c) => c.startAt.getDate()).join('·')}일`;
}

function slotCard(slot) {
  const st = slotStatus(slot);
  const selectable = st === 'available' || st === 'selected';
  const tag = selectable ? 'button' : 'div';
  const attrs = selectable
    ? `data-action="pick-slot" data-key="${esc(slot.key)}" aria-pressed="${st === 'selected'}"`
    : '';
  return `
    <${tag} class="pick" data-state="${st}" ${attrs}>
      <span class="pick__body">
        <span class="pick__name">${esc(slot.name)}</span>
        <span class="pick__time">${slot.timeRange}</span>
        <span class="pick__meta">${placeLine(slot)}</span>
        <span class="pick__sessions">${sessionSummary(slot)}</span>
        <span class="pick__status">${statusChip(st, SLOT_STATUS_LABEL[st])}</span>
      </span>
      ${selectable ? `<span class="pick__check">${icons.check({ size: 13 })}</span>` : ''}
    </${tag}>`;
}

const emptySlots = () => empty({
  title: '조건에 맞는 수업이 없어요.',
  desc: '필터를 변경하거나 다른 달을 확인해 주세요.',
  cta: { label: '필터 초기화', action: 'reset-filter' },
});

/** 목록 — 요일별 반 목록 */
function slotTimetable(slots) {
  if (!slots.length) return emptySlots();
  return CAL_ORDER.map((day) => {
    const items = slots.filter((s) => s.day === day);
    if (!items.length) return '';
    return `
      <section class="day-group">
        <h3 class="day-group__label">${WD_LABEL[day]}요일</h3>
        <div class="mt-8 pick-grid">${items.map(slotCard).join('')}</div>
      </section>`;
  }).join('');
}

/**
 * 주간 시간표 — 요일 컬럼에 시간순으로 쌓는다. 벽에 붙은 시간표와 같은 형태다.
 * 담을 수 있는 상태면 셀을 눌러 바로 담긴다.
 */
function slotGrid(slots, pickable) {
  if (!slots.length) return emptySlots();

  const cols = CAL_ORDER.map((day) => {
    const items = slots.filter((s) => s.day === day);
    return `
      <div class="wcol">
        <div class="wcol__head">${WD_LABEL[day]}</div>
        ${items.length ? items.map((slot) => {
    const st = slotStatus(slot);
    const canPick = pickable && (st === 'available' || st === 'selected');
    const tag = canPick ? 'button' : 'div';
    const attrs = canPick ? `data-action="pick-slot" data-key="${esc(slot.key)}" aria-pressed="${st === 'selected'}"` : '';
    return `
          <${tag} class="gcell" data-state="${st}" ${attrs}>
            <span class="gcell__name">${esc(slot.name)}</span>
            <span class="gcell__time">${slot.time}</span>
            <span class="gcell__meta">${esc(slot.instructor)}${slot.room ? ` · ${esc(slot.room)}` : ''}</span>
            ${st === 'available' || st === 'notopen' ? ''
    // notopen은 이 화면의 모든 셀에 붙는다 — 구분을 못 하니 소음일 뿐이다.
    // 아직 안 열렸다는 건 상단 안내가 이미 말하고 있다.
    : `<span class="gcell__status status--${st}">${SLOT_STATUS_LABEL[st]}</span>`}
          </${tag}>`;
  }).join('') : '<p class="wcol__off">휴무</p>'}
      </div>`;
  }).join('');

  return `
    <div class="grid-wrap mt-16">
      <div class="wgrid">${cols}</div>
    </div>
    <p class="cal__hint">옆으로 밀면 다른 요일을 볼 수 있어요.</p>`;
}

/** 캘린더 — 날짜를 누르면 그 요일 전체가 한 번에 잡힌다 */
function slotCalendar(slots) {
  if (!slots.length) return emptySlots();

  const month = state.enroll.month;
  const last = new Date(2026, month + 1, 0);
  const lead = new Date(2026, month, 1).getDay();   // 일요일 시작
  const { weekdays, perWeek } = state.enroll;

  // 담은 반의 실제 회차는 더 진하게 — 요일만 고른 상태와 구분한다
  const pickedDates = new Set(selection().slots.flatMap((s) => s.remaining.map((c) => ymd(c.startAt))));
  const openDays = new Set(slots.map((s) => s.day));

  // 요일 헤더는 라벨일 뿐 선택 대상이 아니다. 선택은 날짜를 눌러서 한다.
  const head = CAL_ORDER.map((day) => `
    <div class="cal__wdlabel ${weekdays.includes(day) ? 'is-on' : ''}">${WD_LABEL[day]}</div>`).join('');

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cal__cell"></div>');
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(2026, month, d);
    const day = date.getDay();
    const open = openDays.has(day) && date > NOW;
    const cls = [
      'cal__cell',
      isSameDay(date, NOW) ? 'is-today' : '',
      pickedDates.has(ymd(date)) ? 'is-picked' : '',
      weekdays.includes(day) && open ? 'is-focus' : '',
      open ? '' : 'is-off',
    ].filter(Boolean).join(' ');
    cells.push(open
      ? `<button class="${cls}" data-action="cal-weekday" data-value="${day}"
                 aria-label="${d}일 ${WD_LABEL[day]}요일 수업 보기"><span class="n">${d}</span></button>`
      : `<div class="${cls}"><span class="n">${d}</span></div>`);
  }

  const chosen = CAL_ORDER.filter((day) => weekdays.includes(day));

  return `
    <div class="cal">
      <div class="cal__wd">${head}</div>
      <div class="cal__grid">${cells.join('')}</div>
      <p class="cal__hint">
        ${chosen.length
          ? `요일은 ${perWeek}개까지 고를 수 있어요. 같은 요일을 다시 누르면 해제돼요.`
          : '날짜를 누르면 그 요일 전체가 선택돼요.'}
      </p>
    </div>
    ${chosen.map((day) => {
    const items = slots.filter((s) => s.day === day);
    return section(`${WD_LABEL[day]}요일 수업`, items.length
      ? `<div class="pick-grid">${items.map(slotCard).join('')}</div>`
      : '<p class="t-meta">이 요일에는 신청 가능한 수업이 없어요.</p>');
  }).join('')}`;
}

/* ==========================================================================
   보강 · 쿠폰 — 날짜를 골라 그 날 수업 하나를 신청한다
   ========================================================================== */

/** 그 날 신청할 수 있는 수업 한 줄 — 내 수업·홈과 같은 카드를 쓴다 */
function singleCard(c) {
  return classListRow({
    id: c.id,
    action: 'pick-single',
    start: hhmm(c.startAt),
    end: hhmm(c.endAt),
    title: c.name,
    meta: `${placeLine(c)} · ${bookingMethodNames(c).join('·')} 신청 가능`,
  });
}

/** 단건 신청 캘린더 — 주간/월간을 오가며 날짜를 고른다 */
function singleCalendar(list, selected) {
  const days = new Set(list.map((c) => ymd(c.startAt)));
  const base = selected ? parseYmd(selected) : NOW;

  const cell = (d, label) => {
    const key = ymd(d);
    const has = days.has(key);
    return `
      <button class="cal__cell ${selected === key ? 'is-picked' : ''} ${isSameDay(d, NOW) ? 'is-today' : ''} ${has ? '' : 'is-off'}"
              data-action="single-day" data-day="${key}" ${has ? '' : 'disabled'}>
        ${label ? `<span class="wd">${label}</span>` : ''}
        <span class="n">${d.getDate()}</span>
        <span class="mark ${has ? '' : 'mark--none'}"></span>
      </button>`;
  };

  if (state.enroll.singleView === 'week') {
    const start = startOfWeek(base);
    const end = addDays(start, 6);
    return `
      <div class="weeknav mt-16">
        <button class="icon-btn" data-action="single-week-prev" aria-label="이전 주">${icons.chevronLeft({ size: 20 })}</button>
        <span class="weeknav__label">${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}</span>
        <button class="icon-btn" data-action="single-week-next" aria-label="다음 주">${icons.chevronRight({ size: 20 })}</button>
      </div>
      <div class="cal__grid mt-8">
        ${Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(start, i);
    return cell(d, WD_LABEL[d.getDay()]);
  }).join('')}
      </div>`;
  }

  const month = state.enroll.month;
  const last = new Date(2026, month + 1, 0);
  const lead = new Date(2026, month, 1).getDay();   // 일요일 시작
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<div class="cal__cell"></div>');
  for (let d = 1; d <= last.getDate(); d++) cells.push(cell(new Date(2026, month, d), ''));

  return `
    <div class="cal mt-16">
      <div class="cal__wd">${CAL_ORDER.map((d) => `<div>${WD_LABEL[d]}</div>`).join('')}</div>
      <div class="cal__grid">${cells.join('')}</div>
    </div>`;
}

function singleBody() {
  const list = singleBookingList();
  if (!list.length) {
    return empty({
      title: '신청할 수 있는 수업이 없어요.',
      desc: '당일 수업은 신청할 수 없고, 마감된 반은 제외돼요.',
      cta: { label: '필터 초기화', action: 'reset-filter' },
    });
  }

  const selected = singleSelectedDay(list);
  const dayList = list.filter((c) => ymd(c.startAt) === selected);

  return `
    ${singleCalendar(list, selected)}
    ${selected ? section(fmtFullDate(parseYmd(selected)), dayList.length
    ? classListCard({ rows: dayList.map(singleCard) })
    : '<p class="t-meta">이 날에는 신청할 수 있는 수업이 없어요.</p>') : ''}`;
}

/**
 * 보강·쿠폰 단건 신청 — 바텀 네비까지 덮는 풀모달.
 * X로만 나가게 해서, 신청 흐름 중간에 탭으로 새어 나가는 일을 막는다.
 */
export function singleBookingView() {
  const activeCount = filterChipCount();
  const controls = `
    <div class="row-between mt-16">
      <div style="width:160px">${segmentedControl({
    id: 'single',
    options: [{ value: 'week', label: '주간' }, { value: 'month', label: '월간' }],
    value: state.enroll.singleView,
    action: 'single-view',
    from: state.ui.segFrom?.single,
  })}</div>
      <button class="pill ${activeCount ? 'pill--count' : ''}" data-action="open-filter" aria-pressed="false">
        ${icons.filter()} 필터${activeCount ? ` ${activeCount}` : ''}
      </button>
    </div>`;
  return `${header()}<div class="content content--bare">${monthPills()}${controls}${singleBody()}</div>`;
}

/* --- Selection bar -------------------------------------------------------- */
export function selectionBar() {
  if (state.tab !== 'enroll' || state.stack.length || state.enroll.mode !== 'regular') return '';
  const {
    slots, sessions, total, perWeek, picked, left, complete,
  } = selection();
  if (!slots.length) return ''; // 담기 전에는 Selection UI 자체를 표시하지 않는다
  return `
    <div class="selbar">
      <button class="selbar__inner" data-action="open-selected">
        <span>
          <span class="selbar__count">주 ${perWeek}회 · ${picked}/${perWeek} 담음</span>
          <span class="selbar__sub">${complete
    ? `${sessions}회 수업 · ${won(total)}`
    : `${left}개 더 담아주세요`}</span>
        </span>
        <span class="selbar__link">선택 보기 ${icons.chevronRight({ size: 16 })}</span>
      </button>
    </div>`;
}

/* --- view ----------------------------------------------------------------- */
/**
 * 준비중 — 화면을 다시 만드는 동안 여기로 모은다.
 * 홈·마이·취소 완료의 진입 버튼은 그대로 두고 이 화면이 이유를 설명한다.
 * 버튼을 숨기면 그 자리가 비어 "왜 사라졌지"가 되지만, 안내는 상태를 알려준다.
 */
function comingSoon() {
  return `
    <header class="hdr">
      <div class="hdr__top"><h1 class="hdr__title">수강신청</h1></div>
    </header>
    <div class="content">
      <div class="mt-8">${infoNotice({
    tone: 'plain',
    text: '수강신청 화면을 <b>새로 만들고 있어요</b>. 준비되면 알려드릴게요.',
  })}</div>
      <div class="mt-24">${emptyBox('지금은 신청할 수 없어요')}</div>
      <div class="btn-stack mt-24">
        <button class="btn btn--primary btn--sm" data-action="go-my">내 수업 보기</button>
        <button class="btn btn--outline btn--sm" data-action="go-private">개인레슨 예약</button>
      </div>
      <p class="footnote">보강·쿠폰 신청도 함께 준비 중이에요. 급한 건은 관리자에게 문의해 주세요.</p>
    </div>`;
}

export function enrollView() {
  if (!ENROLL_READY) return comingSoon();
  if (state.loadError) {
    return `${header()}<div class="content">${errorState({
      title: '수업 정보를 불러오지 못했어요.',
      desc: '잠시 후 다시 시도해 주세요.',
    })}</div>`;
  }
  if (state.booting) return `${header()}<div class="content">${skeletonList(4)}</div>`;

  if (state.enroll.mode === 'single') {
    return '';   // 단건 신청은 탭 위에 풀모달로 따로 띄운다 (singleBookingView)
  }

  // 남은 회차가 없는 반은 신청 대상이 아니다
  const w = enrollmentWindow();
  const slots = regularSlots().filter((s) => s.remaining.length);
  // 신청이 열리지 않은 달은 담을 수 없으니 한눈에 보는 주간 시간표만 보여준다
  const view = w.open ? state.enroll.view : 'grid';
  const body = view === 'calendar' ? slotCalendar(slots)
    : view === 'timetable' ? slotTimetable(slots)
      : slotGrid(slots, w.open);
  const cls = state.enroll.selectedSlots.length ? 'content content--with-bar' : 'content';

  return `${header()}<div class="${cls}">
    ${monthPills()}${windowNotice(w)}${w.open ? perWeekPicker() : ''}${viewSwitch(w.open)}${body}
  </div>`;
}
