/* ==========================================================================
   발레75 — 내 수업
   "나는 언제, 어떤 수업을 듣고 있지?"
   시간표만 다룬다. 등록·금액·쿠폰 같은 수강 현황은 마이로 옮겼다.

   Figma: Ballet75 / 내 수업 (40:442) — 화면은 components.js의 조각으로만 조립한다.
   ========================================================================== */

import {
  state, weekClasses, monthClasses,
  addDays, dayStart, isSameDay, parseYmd, wd, hhmm,
} from '../state.js';
import { NOW, ymd } from '../data.js';
import { esc, empty, errorState, skeletonList, placeLine } from '../ui.js';
import {
  segmentedControl, calendar, calendarWeekDay, calendarMonthDay,
  classListCard, classListRow,
} from '../components.js';

const WD_LABEL = ['일', '월', '화', '수', '목', '금', '토'];

function header() {
  return `
    <header class="hdr hdr--flush">
      <div class="hdr__top">
        <h1 class="hdr__title">내 수업</h1>
        <button class="pill pill--today" data-action="my-today"><span class="dot"></span>오늘</button>
      </div>
    </header>`;
}

/* --- 수업 묶음 ------------------------------------------------------------
   오늘 묶음만 accent(채움) 카드로 둔다 — 화면에서 제일 먼저 잡혀야 한다.   */
function group(date, items, label) {
  const today = isSameDay(date, NOW);
  const rows = items.map((c) => classListRow({
    id: c.id,
    start: hhmm(c.startAt),
    end: hhmm(c.endAt),
    title: c.name,
    meta: placeLine(c),
    past: c.startAt < NOW,
  }));
  return `
    <section class="daysec">
      <h3 class="daysec__label">${today ? '오늘' : esc(label)}</h3>
      ${classListCard({ tone: today ? 'accent' : 'default', rows })}
    </section>`;
}

/* --- 주간 --------------------------------------------------------------- */
/** 8월 9일 - 15일 / 달을 넘으면 7월 30일 - 8월 5일 */
function weekLabel(start, end) {
  const head = `${start.getMonth() + 1}월 ${start.getDate()}일`;
  return start.getMonth() === end.getMonth()
    ? `${head} - ${end.getDate()}일`
    : `${head} - ${end.getMonth() + 1}월 ${end.getDate()}일`;
}

/** 수업 없는 날은 disabled — 회원의 고정 요일이 한눈에 드러난다 */
function weekRow(weekStart, items, sel) {
  const cells = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(weekStart, i);
    const has = items.some((c) => isSameDay(c.startAt, d));
    return calendarWeekDay({
      wd: WD_LABEL[d.getDay()],
      date: d.getDate(),
      state: has ? (isSameDay(d, sel) ? 'selected' : 'default') : 'disabled',
      today: isSameDay(d, NOW),
      action: 'scroll-day',
      day: ymd(d),
    });
  }).join('');
  return `<div class="calendar__week">${cells}</div>`;
}

function weekBody(weekStart) {
  const items = weekClasses(weekStart);
  const weekEnd = addDays(weekStart, 6);
  const sel = state.my.day ? parseYmd(state.my.day) : NOW;

  const head = calendar({
    label: weekLabel(weekStart, weekEnd),
    prev: 'week-prev',
    next: 'week-next',
    body: weekRow(weekStart, items, sel),
  });

  if (!items.length) {
    return { head, list: empty({
      title: '이번 주에는 수업이 없어요.',
      desc: '다른 주를 확인하거나 새로운 수업을 신청해 보세요.',
      cta: { label: '수업 찾아보기', action: 'go-enroll' },
    }) };
  }

  // 월간과 같은 규칙 — 고른 날부터 그 주 끝까지만 보여준다.
  // 지난 수업을 계속 쌓아두면 '앞으로 뭐가 있나'를 읽기 어렵다.
  const from = sel >= weekStart && sel <= weekEnd ? dayStart(sel) : dayStart(weekStart);
  const days = Array.from({ length: 7 })
    .map((_, i) => addDays(weekStart, i))
    .filter((d) => d >= from && items.some((c) => isSameDay(c.startAt, d)));

  if (!days.length) {
    return { head, list: empty({
      title: '남은 수업이 없어요.',
      desc: '지난 수업을 보려면 위에서 날짜를 골라 주세요.',
    }) };
  }

  return {
    head,
    list: `<div class="band"></div>${days.map((d) => `
      <div id="day-${ymd(d)}">
        ${group(d, items.filter((c) => isSameDay(c.startAt, d)), `${wd(d)}요일`)}
      </div>`).join('')}`,
  };
}

/* --- 월간 --------------------------------------------------------------- */
/** 고른 날 — 보고 있는 달 밖이면 오늘, 그것도 아니면 수업이 있는 첫 날 */
function selectedDay(month, items) {
  const picked = state.my.day ? parseYmd(state.my.day) : null;
  if (picked && picked.getMonth() === month) return picked;
  if (NOW.getMonth() === month) return dayStart(NOW);
  return items.length ? dayStart(items[0].startAt) : new Date(2026, month, 1);
}

function monthGrid(month, items, sel) {
  const last = new Date(2026, month + 1, 0).getDate();
  const lead = new Date(2026, month, 1).getDay();      // 일요일 시작
  const has = new Set(items.map((c) => ymd(c.startAt)));

  const cells = [
    ...WD_LABEL.map((l) => calendarMonthDay({ context: 'label', label: l })),
    ...Array.from({ length: lead }, () => calendarMonthDay({ context: 'blank' })),
    ...Array.from({ length: last }, (_, i) => {
      const d = new Date(2026, month, i + 1);
      const on = has.has(ymd(d));
      return calendarMonthDay({
        date: i + 1,
        state: on ? (isSameDay(d, sel) ? 'selected' : 'default') : 'disabled',
        today: isSameDay(d, NOW),
        action: 'pick-my-day',
        day: ymd(d),
      });
    }),
  ];
  return `<div class="calendar__grid">${cells.join('')}</div>`;
}

function monthBody(month) {
  const items = monthClasses(month);
  const sel = selectedDay(month, items);

  const head = calendar({
    label: `2026년 ${month + 1}월`,
    prev: 'month-prev',
    next: 'month-next',
    body: monthGrid(month, items, sel),
  });

  if (!items.length) {
    return { head, list: empty({
      title: `${month + 1}월에는 수업이 없어요.`,
      desc: '다른 달을 확인하거나 새로운 수업을 신청해 보세요.',
      cta: { label: '수업 찾아보기', action: 'go-enroll' },
    }) };
  }

  // 고른 날부터 그 달 끝까지, 주간과 똑같이 날짜별로 묶는다.
  const byDay = new Map();
  for (const c of items.filter((x) => x.startAt >= dayStart(sel))) {
    const k = ymd(c.startAt);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(c);
  }

  return {
    head,
    list: `<div class="band"></div>${[...byDay.entries()].map(([k, list]) => {
      const d = parseYmd(k);
      return group(d, list, `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} (${wd(d)})`);
    }).join('')}`,
  };
}

/* --- 시간표 --------------------------------------------------------------- */
/**
 * 왼쪽(제목·세그먼트·캘린더)과 오른쪽(날짜별 목록)을 나눠 둔다.
 * 모바일에서는 그냥 위아래로 쌓이고, 데스크톱에서만 두 단이 된다.
 */
function scheduleView() {
  const { view, weekStart, month } = state.my;
  const seg = segmentedControl({
    id: 'my',
    options: [{ value: 'week', label: '주간' }, { value: 'month', label: '월간' }],
    value: view,
    action: 'my-view',
    from: state.ui.segFrom?.my,
  });
  const { head, list } = view === 'week' ? weekBody(weekStart) : monthBody(month);
  return `<div class="myside">${header()}${seg}${head}</div><div class="mylist">${list}</div>`;
}

/* --- view ----------------------------------------------------------------- */
export function myClassesView() {
  if (state.loadError) {
    return `${header()}<div class="content">${errorState({
      title: '수업 정보를 불러오지 못했어요.',
      desc: '잠시 후 다시 시도해 주세요.',
    })}</div>`;
  }
  if (state.booting) return `${header()}<div class="content">${skeletonList(4)}</div>`;

  return `<div class="content content--my">${scheduleView()}</div>`;
}
